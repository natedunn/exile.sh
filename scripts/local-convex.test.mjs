import assert from "node:assert/strict"
import { test } from "node:test"

import {
  anonymousConvexEnv,
  reserveWorktreePorts,
} from "./lib/local-convex.mjs"

test("anonymous mode strips credentials and inherited collector settings", () => {
  assert.deepEqual(
    anonymousConvexEnv({
      CONVEX_DEPLOY_KEY: "secret",
      CONVEX_DEPLOYMENT_TOKEN: "secret",
      COLLECTOR_ENABLED: "true",
      SAFE_VALUE: "kept",
    }),
    {
      CONVEX_AGENT_MODE: "anonymous",
      CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
      SAFE_VALUE: "kept",
    }
  )
})

test("port pair reservations are atomic within concurrent initialization", () => {
  const first = reserveWorktreePorts("/test/worktree/same")
  let second
  try {
    second = reserveWorktreePorts("/test/worktree/same")
    assert.notDeepEqual(
      { cloud: first.cloud, site: first.site },
      { cloud: second.cloud, site: second.site }
    )
  } finally {
    first.release()
    second?.release()
  }
})
