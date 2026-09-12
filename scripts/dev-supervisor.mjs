import { spawn, spawnSync } from "node:child_process"
import path from "node:path"

import { anonymousConvexEnv, anonymousEnvFile } from "./lib/local-convex.mjs"
import { ensurePortlessProxy, portlessCli } from "./lib/portless.mjs"
import { portlessName } from "./portless-name.mjs"

const workspaceRoot = process.cwd()
const bin = (name) => path.join(workspaceRoot, "node_modules", ".bin", name)
const mode = process.env.EXILE_CONVEX_MODE ?? "anonymous"

if (mode === "anonymous") {
  const initialized = spawnSync(
    process.execPath,
    ["scripts/init-local-convex.mjs"],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
    }
  )
  if (initialized.error) throw initialized.error
  if (initialized.status !== 0) process.exit(initialized.status ?? 1)
} else if (mode !== "anonymous" && mode !== "shared") {
  throw new Error(`Unknown EXILE_CONVEX_MODE: ${mode}`)
}

const portlessPort = Number(process.env.PORTLESS_PORT ?? 1355)
if (
  !Number.isInteger(portlessPort) ||
  portlessPort < 1 ||
  portlessPort > 65535
) {
  throw new Error("PORTLESS_PORT must be an integer between 1 and 65535.")
}

const children = []
let stopping = false
function start(command, args, env) {
  const child = spawn(command, args, {
    cwd: workspaceRoot,
    env,
    stdio: ["inherit", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  child.stdout.pipe(process.stdout, { end: false })
  child.stderr.pipe(process.stderr, { end: false })
  children.push(child)
  return child
}

function stop(signal = "SIGTERM") {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try {
      if (child.pid && process.platform !== "win32")
        process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch {
      // Already stopped.
    }
  }
}

process.on("SIGINT", () => {
  stop("SIGINT")
  process.exit(130)
})
process.on("SIGTERM", () => {
  stop()
  process.exit(143)
})
process.on("exit", () => stop())

const convex = start(
  mode === "anonymous" ? bin("convex") : bin("kitcn"),
  mode === "anonymous"
    ? ["dev", "--env-file", anonymousEnvFile(workspaceRoot)]
    : ["dev"],
  mode === "anonymous" ? anonymousConvexEnv() : process.env
)

await new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("Convex was not ready after 120 seconds.")),
    120_000
  )
  const ready = (chunk) => {
    if (!/Convex functions ready!|Convex ready/i.test(String(chunk))) return
    clearTimeout(timeout)
    convex.stdout.off("data", ready)
    convex.stderr.off("data", ready)
    resolve()
  }
  convex.stdout.on("data", ready)
  convex.stderr.on("data", ready)
  convex.once("exit", (code) => {
    clearTimeout(timeout)
    reject(
      new Error(`Convex exited before becoming ready (${code ?? "signal"}).`)
    )
  })
})

if (mode === "anonymous") {
  const pauseCollector = spawnSync(
    bin("convex"),
    [
      "env",
      "set",
      "COLLECTOR_ENABLED",
      "false",
      "--env-file",
      anonymousEnvFile(workspaceRoot),
    ],
    {
      cwd: workspaceRoot,
      env: anonymousConvexEnv(),
      stdio: "inherit",
    }
  )
  if (pauseCollector.error || pauseCollector.status !== 0) {
    console.warn(
      "[convex] could not explicitly pause local collection; stopping startup."
    )
    stop()
    process.exit(pauseCollector.status ?? 1)
  }
  if (process.env.EXILE_SEED !== "0") {
    const seed = spawnSync(
      bin("convex"),
      [
        "run",
        "seed:local",
        "{}",
        "--env-file",
        anonymousEnvFile(workspaceRoot),
      ],
      {
        cwd: workspaceRoot,
        env: anonymousConvexEnv(),
        stdio: "inherit",
      }
    )
    if (seed.error || seed.status !== 0) {
      console.warn(
        "[convex] lightweight seed did not finish; continuing with the empty backend."
      )
    }
  }
  const backfill = spawnSync(bin("kitcn"), ["aggregate", "backfill"], {
    cwd: workspaceRoot,
    env: anonymousConvexEnv(),
    stdio: "inherit",
  })
  if (backfill.error || backfill.status !== 0) {
    console.warn(
      "[convex] aggregate backfill did not finish; continuing with the dev server."
    )
  }
}

await ensurePortlessProxy(workspaceRoot, portlessPort)
const routeName = portlessName("exile")
const vite = start(
  process.execPath,
  [portlessCli(workspaceRoot), routeName, "--force", "bun", "run", "dev:vite"],
  { ...process.env, PORTLESS_PORT: String(portlessPort) }
)

for (const child of [convex, vite]) {
  child.on("exit", (code, signal) => {
    if (stopping) return
    stop()
    if (signal) process.exit(signal === "SIGINT" ? 130 : 143)
    process.exit(code ?? 0)
  })
}
