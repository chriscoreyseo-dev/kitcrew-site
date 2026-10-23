import "server-only"

import { MongoClient } from "mongodb"
import type { Db } from "mongodb"

import { requireEnv } from "@/lib/env"

/** One MongoClient per server process, shared by the Auth.js adapter and the
    app. Cached on globalThis so dev hot reloads do not open a pool each edit.
    Connecting is lazy: nothing touches the network until the first query. */

const globalForMongo = globalThis as typeof globalThis & {
  __hiveMongo?: MongoClient
}

export function mongoClient(): MongoClient {
  if (!globalForMongo.__hiveMongo) {
    const { MONGODB_URI } = requireEnv("db")
    globalForMongo.__hiveMongo = new MongoClient(MONGODB_URI, {
      appName: "hive-studio",
      maxPoolSize: 10,
    })
  }
  return globalForMongo.__hiveMongo
}

export function db(): Db {
  return mongoClient().db(requireEnv("db").MONGODB_DB)
}
