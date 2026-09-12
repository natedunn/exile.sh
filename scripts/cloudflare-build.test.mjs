import { test } from "node:test"
import assert from "node:assert/strict"
import { build, PREVIEW_KEY_PREFIX, PRODUCTION } from "./cloudflare-build.mjs"
import { previewName } from "./preview-name.mjs"

const env = {
  WORKERS_CI_BRANCH: "main",
  CONVEX_PROD_DEPLOY_KEY: `prod:${PRODUCTION}|test-only`,
  CONVEX_DEPLOY_KEY: "wrong-inherited-key",
}
function harness({
  names = "",
  enabled = "true",
  status = "complete",
  fail,
} = {}) {
  const calls = []
  const run = (args, passedEnv) => {
    calls.push({ args, env: passedEnv })
    if (args[0] === fail) throw new Error("simulated failure")
    if (args.includes("--names-only")) return names
    if (args[2] === "get") return enabled
    if (args[1] === "run")
      return JSON.stringify({ status, message: "source unavailable" })
    return ""
  }
  return { calls, run }
}
test("main builds frontend, deploys backend, enables initial collection, and kicks import in order", () => {
  const h = harness()
  build(env, h.run)
  assert.deepEqual(
    h.calls.map((c) => c.args.slice(0, 3)),
    [
      ["kitcn", "deploy", "--cmd"],
      ["convex", "env", "list"],
      ["convex", "env", "set"],
      ["convex", "env", "get"],
      ["convex", "run", "ingestion:ingest"],
    ]
  )
  assert.equal(h.calls[0].env.CONVEX_PROD_DEPLOY_KEY, undefined)
  assert.equal(h.calls[0].env.CONVEX_DEPLOY_KEY, env.CONVEX_PROD_DEPLOY_KEY)
  assert.equal(h.calls[0].env.VITE_CONVEX_URL, undefined)
})
test("preview deploys an isolated Convex backend before the Worker build", () => {
  const h = harness()
  build(
    {
      ...env,
      WORKERS_CI_BRANCH: "feature/one",
      CONVEX_PREVIEW_DEPLOY_KEY: `${PREVIEW_KEY_PREFIX}test-only`,
      VITE_CONVEX_URL: "https://wrong.convex.cloud",
    },
    h.run
  )
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.calls[0].args.slice(-4), [
    "--preview-name",
    "feature-one",
    "--preview-run",
    "seed:local",
  ])
  assert.equal(
    h.calls[0].env.CONVEX_DEPLOY_KEY,
    `${PREVIEW_KEY_PREFIX}test-only`
  )
  assert.equal(h.calls[0].env.VITE_CONVEX_URL, undefined)
  assert.equal(h.calls[0].env.CONVEX_PROD_DEPLOY_KEY, undefined)
})
test("redeployment preserves explicit collection pause", () => {
  const h = harness({
    names: "COLLECTOR_ENABLED\nGGG_CONTACT",
    enabled: "false",
  })
  build(env, h.run)
  assert.equal(
    h.calls.some((c) => c.args[2] === "set" || c.args[1] === "run"),
    false
  )
})
test("missing branch or wrong key stops before any command", () => {
  const h = harness()
  assert.throws(() => build({}, h.run), /WORKERS_CI_BRANCH/)
  assert.throws(
    () => build({ ...env, CONVEX_PROD_DEPLOY_KEY: "dev:other|key" }, h.run),
    /production deploy key/
  )
  assert.equal(h.calls.length, 0)
})
test("frontend or backend failure stops initialization", () => {
  for (const fail of ["kitcn"]) {
    const h = harness({ fail })
    assert.throws(() => build(env, h.run), /simulated failure/)
    assert.equal(
      h.calls.some((c) => c.args[0] === "convex"),
      false
    )
  }
})
test("preview builds require a project-scoped preview key", () => {
  const h = harness()
  assert.throws(
    () => build({ WORKERS_CI_BRANCH: "feature/one" }, h.run),
    /CONVEX_PREVIEW_DEPLOY_KEY/
  )
  assert.equal(h.calls.length, 0)
})
test("preview names are safe and stable for Convex and Worker aliases", () => {
  assert.equal(previewName("Feature/My Big_change"), "feature-my-big-change")
  assert.equal(previewName("---"), "preview")
})
test("initial collection error fails the build", () => {
  const h = harness({ status: "error" })
  assert.throws(() => build(env, h.run), /Initial collection failed/)
})
