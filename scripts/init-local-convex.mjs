import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  anonymousConvexEnv,
  anonymousEnvFile,
  configureWorktreePorts,
  ensureAnonymousEnvFile,
  localConfigFile,
  reserveWorktreePorts,
} from "./lib/local-convex.mjs"

const workspaceRoot = process.cwd()
ensureAnonymousEnvFile(workspaceRoot)

if (!fs.existsSync(localConfigFile(workspaceRoot))) {
  console.log("[convex] creating this worktree's anonymous local backend…")
  const shouldSeed = process.env.EXILE_SEED !== "0"
  const reservation = reserveWorktreePorts(workspaceRoot)
  try {
    const result = spawnSync(
      path.join(workspaceRoot, "node_modules", ".bin", "convex"),
      [
        "dev",
        "--once",
        ...(shouldSeed ? ["--run", "seed:local"] : []),
        "--env-file",
        anonymousEnvFile(workspaceRoot),
        "--local-cloud-port",
        String(reservation.cloud),
        "--local-site-port",
        String(reservation.site),
      ],
      { env: anonymousConvexEnv(), stdio: "inherit" }
    )
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
  } finally {
    reservation.release()
  }
}

const ports = configureWorktreePorts(workspaceRoot)
if (!ports)
  throw new Error("Convex did not create a local backend configuration.")
console.log(
  `[convex] anonymous backend ready on worktree-local ports ${ports.cloud}/${ports.site}`
)
