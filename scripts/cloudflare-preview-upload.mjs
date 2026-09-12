import { spawnSync } from "node:child_process"

import { currentBranch, previewName } from "./preview-name.mjs"

const alias = previewName(currentBranch())
const result = spawnSync(
  "bun",
  [
    "x",
    "wrangler",
    "versions",
    "upload",
    "--config",
    "dist/server/wrangler.json",
    "--keep-vars",
    "--preview-alias",
    alias,
  ],
  { stdio: "inherit" }
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
