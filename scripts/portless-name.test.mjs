import assert from "node:assert/strict"
import { test } from "node:test"

import { portlessName } from "./portless-name.mjs"

const gitDir = "/repo/.git/worktrees/feature"

test("linked worktree routes include a stable path-derived suffix", () => {
  const first = portlessName("exile", {
    env: {},
    topLevel: "/one/worktrees/feature",
    gitDir,
  })
  const repeated = portlessName("exile", {
    env: {},
    topLevel: "/one/worktrees/feature",
    gitDir,
  })
  const otherParent = portlessName("exile", {
    env: {},
    topLevel: "/two/worktrees/feature",
    gitDir,
  })

  assert.match(first, /^feature-exile-[a-f0-9]{8}$/)
  assert.equal(first, repeated)
  assert.notEqual(first, otherParent)
  assert.ok(first.length <= 63)
  assert.ok(
    portlessName("exile", {
      env: {},
      topLevel: `/one/worktrees/${"feature".repeat(20)}`,
      gitDir,
    }).length <= 63
  )
})

test("the primary checkout keeps the short route and honors overrides", () => {
  assert.equal(
    portlessName("Exile", {
      env: {},
      topLevel: "/repo/exile",
      gitDir: "/repo/exile/.git",
    }),
    "exile"
  )
  assert.equal(
    portlessName("exile", { env: { PORTLESS_NAME: "mine" } }),
    "mine"
  )
})
