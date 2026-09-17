import { test } from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import { buildSync } from "esbuild"

const bundled = buildSync({
  entryPoints: ["convex/functions/auth.config.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
}).outputFiles[0].text

function evaluate(values) {
  const reads = []
  // Model Convex auth-config analysis, which rejects reads of absent env vars
  // even when the application would otherwise supply a Zod default.
  const env = new Proxy(values, {
    get(target, key) {
      reads.push(key)
      if (!Object.hasOwn(target, key))
        throw new Error(`Missing env: ${String(key)}`)
      return target[key]
    },
  })
  const context = { process: { env }, module: { exports: {} }, btoa }
  vm.runInNewContext(bundled, context)
  return { config: context.module.exports.default, reads }
}

test("fresh backend auth config needs only Convex's built-in site URL", () => {
  const { config, reads } = evaluate({
    CONVEX_SITE_URL: "http://127.0.0.1:3211",
  })
  assert.equal(
    config.providers[0].jwks,
    "http://127.0.0.1:3211/api/auth/convex/jwks"
  )
  assert.deepEqual([...new Set(reads)], ["CONVEX_SITE_URL"])
})

test("configured static signing keys remain supported", () => {
  const { config } = evaluate({
    CONVEX_SITE_URL: "https://example.convex.site",
    JWKS: "[]",
  })
  assert.equal(
    config.providers[0].jwks,
    `data:text/plain;charset=utf-8;base64,${btoa('{"keys":[]}')}`
  )
})
