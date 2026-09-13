import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const syncScript = fileURLToPath(
  new URL("./sync-worktree-env.mjs", import.meta.url)
)
const installScript = fileURLToPath(
  new URL("./install-worktree-env-hook.mjs", import.meta.url)
)

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "exile env "))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const main = path.join(directory, "main checkout")
  const worktree = path.join(directory, "new worktree")
  fs.mkdirSync(main)
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
  }
  const run = (cwd, command, args) =>
    execFileSync(command, args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  const git = (...args) => run(main, "git", args)
  git("init")
  git("config", "user.name", "Env test")
  git("config", "user.email", "env@example.test")
  fs.writeFileSync(
    path.join(main, ".gitignore"),
    ".env\n.env.*\n!.env.example\n.dev.vars*\n"
  )
  fs.writeFileSync(path.join(main, ".env.example"), "EXAMPLE=tracked\n")
  git("add", ".")
  git("commit", "-m", "fixture")
  const node = (script, cwd = main) => run(cwd, process.execPath, [script])
  const addWorktree = () => git("worktree", "add", "-b", "feature", worktree)
  return { main, worktree, git, node, addWorktree, directory }
}

test("installed hook copies ignored env files on worktree creation, even on older branches", (t) => {
  const { main, worktree, node, addWorktree } = fixture(t)
  fs.mkdirSync(path.join(main, "convex"))
  const files = [
    ".env",
    ".env.local",
    ".env.development.local",
    ".dev.vars",
    ".dev.vars.preview",
    "convex/.env",
  ]
  for (const file of files)
    fs.writeFileSync(path.join(main, file), "VALUE=fixture\n")
  node(installScript)
  addWorktree()
  for (const file of files) {
    assert.equal(
      fs.readFileSync(path.join(worktree, file), "utf8"),
      "VALUE=fixture\n"
    )
    assert.equal(fs.statSync(path.join(worktree, file)).mode & 0o777, 0o600)
  }
  assert.equal(
    fs.readFileSync(path.join(worktree, ".env.example"), "utf8"),
    "EXAMPLE=tracked\n"
  )
  fs.writeFileSync(path.join(worktree, ".env.local"), "VALUE=custom\n")
  node(syncScript, worktree)
  assert.equal(
    fs.readFileSync(path.join(worktree, ".env.local"), "utf8"),
    "VALUE=custom\n"
  )
})

test("sync tolerates missing source files, main checkout, and non-Git directories", (t) => {
  const { main, worktree, directory, node, addWorktree } = fixture(t)
  addWorktree()
  node(syncScript, worktree)
  assert.equal(fs.existsSync(path.join(worktree, ".env.local")), false)
  node(syncScript, main)
  node(syncScript, directory)
  node(installScript, directory)
})

test("existing hooks and custom hook managers are preserved", (t) => {
  const { main, node, git } = fixture(t)
  const hook = path.join(main, ".git/hooks/post-checkout")
  fs.writeFileSync(hook, "#!/bin/sh\nexit 0\n")
  node(installScript)
  assert.equal(fs.readFileSync(hook, "utf8"), "#!/bin/sh\nexit 0\n")
  git("config", "core.hooksPath", "custom hooks")
  node(installScript)
  assert.equal(fs.existsSync(path.join(main, "custom hooks")), false)
})

test("installing from a linked worktree registers a shared hook and can be repeated", (t) => {
  const { main, worktree, node, addWorktree, git, directory } = fixture(t)
  addWorktree()
  fs.writeFileSync(path.join(main, ".env.local"), "VALUE=fixture\n")
  node(installScript, worktree)
  node(installScript, worktree)
  const second = path.join(directory, "second worktree")
  git("worktree", "add", "-b", "second", second)
  assert.equal(
    fs.readFileSync(path.join(second, ".env.local"), "utf8"),
    "VALUE=fixture\n"
  )
})

test("tracked env files in either checkout are not copied", (t) => {
  const { main, worktree, node, addWorktree, git } = fixture(t)
  fs.writeFileSync(path.join(main, ".env.tracked"), "VALUE=tracked\n")
  git("add", "-f", ".env.tracked")
  git("commit", "-m", "track env fixture")
  addWorktree()
  fs.unlinkSync(path.join(worktree, ".env.tracked"))
  node(syncScript, worktree)
  assert.equal(fs.existsSync(path.join(worktree, ".env.tracked")), false)
})

test("tracked symlink parents cannot redirect env copies outside a new worktree", (t) => {
  const { main, worktree, directory, node, addWorktree, git } = fixture(t)
  const outside = path.join(directory, "outside worktree")
  const target = path.join(directory, "symlink worktree")
  fs.mkdirSync(outside)
  fs.mkdirSync(path.join(main, "convex"))
  fs.writeFileSync(path.join(main, "convex/.env"), "VALUE=private-fixture\n")
  fs.writeFileSync(path.join(main, ".env.local"), "VALUE=root-fixture\n")

  // Commit the redirect in another branch before Git checks it out with the hook.
  addWorktree()
  fs.symlinkSync(outside, path.join(worktree, "convex"))
  git("-C", worktree, "add", "convex")
  git("-C", worktree, "commit", "-m", "track symlink fixture")
  node(installScript)
  git("worktree", "add", "--detach", target, "feature")

  assert.equal(fs.lstatSync(path.join(target, "convex")).isSymbolicLink(), true)
  assert.deepEqual(fs.readdirSync(outside), [])
  // Prove the hook ran and still copies ordinary env files.
  assert.equal(
    fs.readFileSync(path.join(target, ".env.local"), "utf8"),
    "VALUE=root-fixture\n"
  )
  node(syncScript, target)
  assert.deepEqual(fs.readdirSync(outside), [])
})
