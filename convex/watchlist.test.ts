/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import schema from "./functions/schema"
import { api } from "./shared/api"
const modules = import.meta.glob("./functions/**/*.ts")
beforeEach(() => {
  vi.stubEnv("DISCORD_CLIENT_ID", "test-client-id")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret")
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-only-secret-at-least-thirty-two-characters"
  )
  vi.stubEnv("SITE_URL", "http://localhost:3000")
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211")
})
afterEach(() => vi.unstubAllEnvs())

async function signIn(t: ReturnType<typeof convexTest>, email: string) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("user", {
      name: "exile",
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    const sessionId = await ctx.db.insert("session", {
      userId,
      token: crypto.randomUUID(),
      expiresAt: now + 86400000,
      createdAt: now,
      updatedAt: now,
    })
    return { userId, sessionId }
  })
  return t.withIdentity({ subject: userId, sessionId })
}

const { list, set, merge } = api.watchlist

test("watchlist endpoints reject anonymous callers", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(list.functionRef, {})).rejects.toThrow("Sign in")
  await expect(
    t.mutation(set.functionRef, { item: "divine", watched: true })
  ).rejects.toThrow("Sign in")
  await expect(
    t.mutation(merge.functionRef, { items: ["divine"] })
  ).rejects.toThrow("Sign in")
})

test("stars are idempotent and private to each account", async () => {
  const t = convexTest(schema, modules)
  const first = await signIn(t, "first@example.com")
  const second = await signIn(t, "second@example.com")
  await first.mutation(set.functionRef, { item: "divine", watched: true })
  await first.mutation(set.functionRef, { item: "divine", watched: true })
  await first.mutation(set.functionRef, { item: "exalted", watched: true })
  expect((await first.query(list.functionRef, {})).sort()).toEqual([
    "divine",
    "exalted",
  ])
  expect(await second.query(list.functionRef, {})).toEqual([])
  await first.mutation(set.functionRef, { item: "divine", watched: false })
  await first.mutation(set.functionRef, { item: "divine", watched: false })
  expect(await first.query(list.functionRef, {})).toEqual(["exalted"])
})

test("merging browser stars adds only what the account lacks", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "merge@example.com")
  await user.mutation(set.functionRef, { item: "divine", watched: true })
  expect(
    await user.mutation(merge.functionRef, {
      items: ["divine", "chaos", "chaos", "exalted"],
    })
  ).toEqual({ added: 2 })
  expect((await user.query(list.functionRef, {})).sort()).toEqual([
    "chaos",
    "divine",
    "exalted",
  ])
  expect(await user.mutation(merge.functionRef, { items: ["chaos"] })).toEqual({
    added: 0,
  })
})
