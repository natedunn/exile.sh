#!/usr/bin/env node
// exile-sh worktree env hook v1
// Kept standalone so the installed hook also works on older branches.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
}

function ignored(root, file) {
  try {
    git(root, ["check-ignore", "--quiet", "--", file])
    return true
  } catch {
    return false
  }
}

function sync() {
  // Git passes old HEAD, new HEAD, and 0 for file / 1 for branch checkouts.
  if (process.argv.length === 5 && process.argv[4] !== "1") return

  let root
  let mainRecord
  try {
    root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trimEnd()
    mainRecord = git(root, ["worktree", "list", "--porcelain", "-z"])
      .split("\0\0")[0]
      .split("\0")
  } catch {
    // Source archives and build environments may not have Git metadata.
    return
  }
  if (mainRecord.includes("bare")) return
  const main = mainRecord[0].slice("worktree ".length)
  if (fs.realpathSync(root) === fs.realpathSync(main)) return

  for (const directory of ["", "convex"]) {
    const sourceDirectory = path.join(main, directory)
    if (!fs.existsSync(sourceDirectory)) continue
    for (const entry of fs.readdirSync(sourceDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !/^\.(env|dev\.vars)(\..+)?$/.test(entry.name)) {
        continue
      }
      const file = path.join(directory, entry.name)
      // Only local, ignored files; tracked examples/config stay in Git.
      if (!ignored(main, file) || !ignored(root, file)) continue
      const destination = path.join(root, file)
      if (fs.existsSync(destination)) continue
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      try {
        fs.writeFileSync(destination, fs.readFileSync(path.join(main, file)), {
          flag: "wx",
          mode: 0o600,
        })
        console.log(`[env] Copied ${file} from the main checkout`)
      } catch (error) {
        if (error.code !== "EEXIST") throw error
      }
    }
  }
}

try {
  sync()
} catch (error) {
  console.error(`[env] Could not copy worktree env files: ${error.message}`)
  process.exitCode = 1
}
