import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

function install() {
  let hooksDirectory
  try {
    hooksDirectory = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-path", "hooks"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trimEnd()
    // Leave custom hook managers alone; env:sync still works independently.
    const customHooks = execFileSync(
      "git",
      ["config", "--get-all", "core.hooksPath"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    ).trim()
    if (customHooks) {
      console.warn(
        "[env] Custom Git hooks configured; use bun run env:sync in worktrees."
      )
      return
    }
  } catch (error) {
    if (!hooksDirectory) return
    if (error.status !== 1) throw error
  }

  const hook = path.join(hooksDirectory, "post-checkout")
  const marker = "// exile-sh worktree env hook v1"
  if (fs.existsSync(hook) && !fs.readFileSync(hook, "utf8").includes(marker)) {
    console.warn(
      "[env] Existing post-checkout hook preserved; use bun run env:sync in worktrees."
    )
    return
  }
  fs.mkdirSync(hooksDirectory, { recursive: true })
  fs.copyFileSync(new URL("./sync-worktree-env.mjs", import.meta.url), hook)
  fs.chmodSync(hook, 0o755)
  console.log("[env] Installed env-copy hook for new worktrees")
}

install()
