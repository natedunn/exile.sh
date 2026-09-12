import { execFileSync } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { boundedHashedName, sanitizeName } from "./lib/names.mjs"

function git(args, fallback) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return fallback
  }
}

export function portlessName(
  baseName = "exile",
  {
    env = process.env,
    topLevel = git(["rev-parse", "--show-toplevel"], process.cwd()),
    gitDir = git(["rev-parse", "--absolute-git-dir"], ""),
  } = {}
) {
  if (env.PORTLESS_NAME) return env.PORTLESS_NAME
  const base = sanitizeName(baseName) || "exile"
  if (!/[\\/]\.git[\\/]worktrees[\\/]/.test(gitDir)) return base
  return boundedHashedName(`${path.basename(topLevel)}-${base}`, topLevel, {
    fallback: base,
    maxLength: 63,
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(portlessName(process.argv[2]))
}
