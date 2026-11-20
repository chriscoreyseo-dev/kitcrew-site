// Starts the built studio in one mode for the E2E suite: the standalone
// server (what the Docker image runs) on Linux/macOS, `next start` on Windows,
// where pnpm's symlinks inside .next/standalone can't be followed without
// Developer Mode. Same build either way.
//   node e2e/start-studio.mjs markethive 3101
//   node e2e/start-studio.mjs standalone 3102
// Run `pnpm build` first. Every external service points at e2e/mocks/server.mjs.
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const STANDALONE = path.join(ROOT, ".next", "standalone")
const [mode, port] = [process.argv[2], process.argv[3]]
if (!["markethive", "standalone"].includes(mode) || !port)
  throw new Error("usage: start-studio.mjs <markethive|standalone> <port>")
if (!existsSync(path.join(STANDALONE, "server.js")))
  throw new Error("Run `pnpm build` before the E2E suite.")
const useStandalone = process.platform !== "win32"

if (useStandalone) {
  // The standalone bundle doesn't include static assets; copy them in (idempotent).
  cpSync(
    path.join(ROOT, ".next", "static"),
    path.join(STANDALONE, ".next", "static"),
    {
      recursive: true,
    }
  )
  cpSync(path.join(ROOT, "public"), path.join(STANDALONE, "public"), {
    recursive: true,
  })
}

const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 4010}`
const MONGO = `mongodb://127.0.0.1:${process.env.E2E_MONGO_PORT ?? 27117}/?replicaSet=rs0e2e&directConnection=true`
const media = path.join(ROOT, "e2e", ".data", `media-${mode}`)
mkdirSync(media, { recursive: true })

const common = {
  NODE_ENV: "production",
  PORT: port,
  HOSTNAME: "127.0.0.1",
  STUDIO_MODE: mode,
  APP_URL: `http://localhost:${port}`,
  MONGODB_URI: MONGO,
  MONGODB_DB: `e2e-${mode}`,
  DB_INIT_AT_BOOT: "1",
  HF_API_BASE_URL: `${MOCK}/hf`,
  HF_CREDENTIALS: "e2e_key:e2e_secret",
  HF_WEBHOOK_SECRET: "e2e-webhook-secret-0123456789abcdef",
  STORAGE_DRIVER: "local",
  LOCAL_STORAGE_DIR: media,
  INTERNAL_CRON_SECONDS: "2",
  E2E_ALLOW_HTTP_OUTPUTS: "1",
}
const perMode =
  mode === "markethive"
    ? {
        MARKETHIVE_BASE_URL: MOCK,
        MARKETHIVE_SHARED_SECRET:
          process.env.E2E_SHARED_SECRET ?? "e2e-shared-secret-0123456789abcdef",
        MARKETHIVE_FRAME_ANCESTORS: MOCK,
        MARKETHIVE_CREDITS_URL: `${MOCK}/wallet`,
        GENERATION_ACCESS: "admins",
      }
    : {
        AUTH_SECRET: "e2e-auth-secret-0123456789abcdef",
        AUTH_URL: `http://localhost:${port}`,
        AUTH_RESEND_KEY: "re_e2e_dummy",
        RESEND_BASE_URL: MOCK,
        EMAIL_FROM: "Hive Studio <login@kitcrew.test>",
        SIGNUP_BONUS_CREDITS: "100",
        STRIPE_SECRET_KEY: "sk_test_e2e_dummy",
        STRIPE_WEBHOOK_SECRET: "whsec_e2e_dummy",
        GENERATION_ACCESS: "everyone",
      }

// Only the variables above: nothing from the developer's shell leaks in.
const [cwd, args] = useStandalone
  ? [STANDALONE, ["server.js"]]
  : [
      ROOT,
      [
        path.join(ROOT, "node_modules", "next", "dist", "bin", "next"),
        "start",
        "-p",
        port,
        "-H",
        "127.0.0.1",
      ],
    ]
const child = spawn(process.execPath, args, {
  cwd,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ...common,
    ...perMode,
  },
  stdio: "inherit",
})
const stop = () => child.kill()
process.on("SIGTERM", stop)
process.on("SIGINT", stop)
child.on("exit", (code) => process.exit(code ?? 0))
