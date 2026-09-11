import { makeFunctionReference } from "convex/server"
import type { ActionCtx } from "./functions/_generated/server"
/// <reference types="vite/client" />
import { readFileSync } from "node:fs"
import { convexTest } from "convex-test"
import { afterEach, expect, test, vi } from "vitest"
import schema from "./functions/schema"
import { api } from "./shared/api"
const modules = import.meta.glob("./functions/**/*.ts")
const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
test("anonymous creation is immutable, validated and readable by its opaque link", async () => {
  const t = convexTest(schema, modules)
  const slug = crypto.randomUUID()
  expect(await t.query(api.builds.get.functionRef, { slug })).toBeNull()
  await t.mutation(api.builds.create.functionRef, {
    slug,
    title: "Shaman",
    code,
  })
  const saved = await t.query(api.builds.get.functionRef, { slug })
  expect(saved?.snapshot.ascendancy).toBe("Shaman")
  expect(saved?.code).toBe(code)
  await expect(
    t.mutation(api.builds.create.functionRef, {
      slug,
      title: "Overwrite",
      code,
    })
  ).rejects.toThrow("already exists")
  await expect(
    t.mutation(api.builds.create.functionRef, {
      slug: crypto.randomUUID(),
      title: "Invalid",
      code: "garbage",
    })
  ).rejects.toThrow()
  expect((await t.query(api.builds.get.functionRef, { slug }))?.title).toBe(
    "Shaman"
  )
})
test("publishing budget is enforced server-side", async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    await ctx.db.insert("buildLimits", {
      key: "publish",
      window: Math.floor(Date.now() / 60_000),
      count: 30,
    })
  })
  await expect(
    t.mutation(api.builds.create.functionRef, {
      slug: crypto.randomUUID(),
      title: "Limited",
      code,
    })
  ).rejects.toThrow("try again in a minute")
})

// Match the project's existing transport adapter: run the real internal mutation
// while bypassing generated CommonJS require in Vitest's ESM loader.
vi.mock("./functions/generated/buildImportBudget.runtime", () => ({
  createBuildImportBudgetCaller: (ctx: ActionCtx) => ({
    reserveImport: () =>
      ctx.runMutation(
        makeFunctionReference<"mutation", Record<string, never>, null>(
          "buildImportBudget:reserveImport"
        ),
        {}
      ),
  }),
}))
afterEach(() => vi.unstubAllGlobals())
test("URL import identifies the app, validates data, and refuses foreign origins", async () => {
  const t = convexTest(schema, modules)
  const fetcher = vi.fn(async () => new Response(code))
  vi.stubGlobal("fetch", fetcher)
  expect(
    await t.action(api.builds.resolve.functionRef, {
      url: "https://pobb.in/example",
    })
  ).toBe(code)
  expect(fetcher).toHaveBeenCalledWith(
    "https://pobb.in/example/raw",
    expect.objectContaining({
      redirect: "error",
      headers: {
        Accept: "text/plain",
        "User-Agent":
          "exile.sh/0.1 (https://exile.sh; contact: https://github.com/natedunn/exile.sh/issues)",
      },
    })
  )
  await expect(
    t.action(api.builds.resolve.functionRef, {
      url: "https://example.com/secret",
    })
  ).rejects.toThrow("valid pobb.in")
  expect(fetcher).toHaveBeenCalledTimes(1)
})
test("URL import handles unavailable and oversized responses", async () => {
  const t = convexTest(schema, modules)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("Missing", { status: 404 }))
  )
  await expect(
    t.action(api.builds.resolve.functionRef, { url: "https://pobb.in/missing" })
  ).rejects.toThrow("could not be fetched")
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("x".repeat(180_001)))
  )
  await expect(
    t.action(api.builds.resolve.functionRef, { url: "https://pobb.in/large" })
  ).rejects.toThrow("too large")
})
