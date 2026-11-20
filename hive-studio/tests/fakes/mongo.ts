import { find, update } from "mingo"

/** In-memory stand-in for the slice of the MongoDB driver the app uses,
    backed by mingo's query/update engine. Enforces declared unique keys. */

type Doc = Record<string, unknown>
type Opts = {
  returnDocument?: "before" | "after"
  upsert?: boolean
  projection?: unknown
  limit?: number
  session?: unknown
}

/** Deep copy that keeps ObjectId/Date instances (structuredClone drops prototypes). */
function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value
  if (value instanceof Date) return new Date(value.getTime()) as T
  if ((value as { _bsontype?: string })._bsontype === "ObjectId") return value
  if (Array.isArray(value)) return value.map(clone) as T
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, clone(v)])
  ) as T
}

export class DuplicateKeyError extends Error {
  code = 11000
}

function keyOf(doc: Doc, fields: string[]): string | null {
  const values = fields.map((f) => doc[f])
  if (values.some((v) => v === undefined)) return null
  return JSON.stringify(values.map((v) => String(v)))
}

export class FakeCollection {
  docs: Doc[] = []
  constructor(private unique: string[][] = []) {}

  private assertUnique(candidate: Doc, ignore?: Doc) {
    for (const fields of this.unique) {
      const key = keyOf(candidate, fields)
      if (
        key &&
        this.docs.some((d) => d !== ignore && keyOf(d, fields) === key)
      )
        throw new DuplicateKeyError(`duplicate key ${fields.join(",")}`)
    }
  }

  private apply(doc: Doc, modifier: Doc) {
    const rest = { ...modifier }
    delete rest.$setOnInsert
    if (Object.keys(rest).length) update(doc, rest as never)
  }

  find(filter: Doc = {}, opts: Opts = {}) {
    let sortSpec: Record<string, 1 | -1> | undefined
    let limitN: number | undefined
    const cursor = {
      sort: (spec: Record<string, 1 | -1>) => ((sortSpec = spec), cursor),
      limit: (n: number) => ((limitN = n), cursor),
      toArray: async () => {
        let c = find(this.docs, filter as never)
        if (sortSpec) c = c.sort(sortSpec as never)
        if (limitN) c = c.limit(limitN)
        return c.all().map((d) => clone(d)) as never[]
      },
    }
    void opts
    return cursor
  }

  async findOne(filter: Doc) {
    const hit = find(this.docs, filter as never).next() as Doc | undefined
    return hit ? (clone(hit) as never) : null
  }

  async countDocuments(filter: Doc) {
    return find(this.docs, filter as never).all().length
  }

  async insertOne(doc: Doc) {
    this.assertUnique(doc)
    this.docs.push(clone(doc))
    return { insertedId: doc._id }
  }

  async updateOne(filter: Doc, modifier: Doc, opts: Opts = {}) {
    const target = find(this.docs, filter as never).next() as Doc | undefined
    if (!target) {
      if (opts.upsert) {
        const created: Doc = {
          ...plainEquality(filter),
          ...((modifier.$setOnInsert as Doc) ?? {}),
        }
        this.apply(created, modifier)
        await this.insertOne(created)
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    }
    const next = clone(target)
    this.apply(next, modifier)
    this.assertUnique(next, target)
    Object.assign(target, next)
    for (const k of Object.keys(target)) if (!(k in next)) delete target[k]
    return { matchedCount: 1, modifiedCount: 1 }
  }

  async updateMany(filter: Doc, modifier: Doc) {
    const targets = find(this.docs, filter as never).all() as Doc[]
    for (const t of targets) this.apply(t, modifier)
    return { matchedCount: targets.length, modifiedCount: targets.length }
  }

  async findOneAndUpdate(filter: Doc, modifier: Doc, opts: Opts = {}) {
    const target = find(this.docs, filter as never).next() as Doc | undefined
    if (!target) {
      if (!opts.upsert) return null
      await this.updateOne(filter, modifier, { upsert: true })
      return (await this.findOne(plainEquality(filter))) as never
    }
    const before = clone(target)
    await this.updateOne({ _id: target._id }, modifier)
    return (opts.returnDocument === "after" ? clone(target) : before) as never
  }

  async deleteOne(filter: Doc) {
    const target = find(this.docs, filter as never).next() as Doc | undefined
    if (!target) return { deletedCount: 0 }
    this.docs = this.docs.filter((d) => d !== target)
    return { deletedCount: 1 }
  }
}

function plainEquality(filter: Doc): Doc {
  return Object.fromEntries(
    Object.entries(filter).filter(
      ([k, v]) =>
        !k.startsWith("$") &&
        (v === null ||
          typeof v !== "object" ||
          v.constructor?.name === "ObjectId")
    )
  )
}

export function fakeDb(unique: Record<string, string[][]> = {}) {
  const collections = new Map<string, FakeCollection>()
  let queue: Promise<unknown> = Promise.resolve()
  return {
    collections,
    collection(name: string) {
      if (!collections.has(name))
        collections.set(name, new FakeCollection(unique[name] ?? []))
      return collections.get(name)!
    },
    /** Serializable transactions: one at a time; a throw restores every
        collection to its state when the transaction began. */
    client: {
      startSession() {
        return {
          async withTransaction(fn: () => Promise<unknown>) {
            const run = queue.then(async () => {
              const snapshot = new Map(
                [...collections].map(([k, c]) => [k, clone(c.docs)])
              )
              try {
                await fn()
              } catch (error) {
                for (const [k, c] of collections) c.docs = snapshot.get(k) ?? []
                throw error
              }
            })
            queue = run.catch(() => undefined)
            await run
          },
          async endSession() {},
        }
      },
    },
  }
}
