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

async function signIn(
  t: ReturnType<typeof convexTest>,
  email: string,
  confirmed = true
) {
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
    if (confirmed)
      await ctx.db.insert("profiles", {
        userId,
        username: email.split("@")[0],
      })
    return { userId, sessionId }
  })
  return t.withIdentity({ subject: userId, sessionId })
}

const { get, save, merge } = api.patchReadState

test("read state needs a confirmed account", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(get.functionRef, {})).rejects.toThrow("Sign in")
  const pending = await signIn(t, "pending@example.com", false)
  await expect(pending.mutation(save.functionRef, {})).rejects.toThrow(
    "Create your exile.sh account"
  )
})

test("seen times only move forward and settings persist", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "reader@example.com")
  expect(await user.query(get.functionRef, {})).toBeNull()
  await user.mutation(save.functionRef, { patchSeenAt: 100, xSeenAt: 50 })
  await user.mutation(save.functionRef, { patchSeenAt: 80, includeX: true })
  expect(await user.query(get.functionRef, {})).toEqual({
    patchSeenAt: 100,
    xSeenAt: 50,
    badge: true,
    includeX: true,
  })
  await user.mutation(save.functionRef, { badge: false, xSeenAt: 70 })
  expect(await user.query(get.functionRef, {})).toMatchObject({
    badge: false,
    xSeenAt: 70,
  })
})

test("merging browser state keeps account settings", async () => {
  const t = convexTest(schema, modules)
  const fresh = await signIn(t, "fresh@example.com")
  const browser = { patchSeenAt: 30, xSeenAt: 20, badge: false, includeX: true }
  await fresh.mutation(merge.functionRef, browser)
  expect(await fresh.query(get.functionRef, {})).toEqual(browser)

  const existing = await signIn(t, "existing@example.com")
  await existing.mutation(save.functionRef, { patchSeenAt: 10, xSeenAt: 40 })
  await existing.mutation(merge.functionRef, browser)
  expect(await existing.query(get.functionRef, {})).toEqual({
    patchSeenAt: 30,
    xSeenAt: 40,
    badge: true,
    includeX: false,
  })
})

test("newest reports the latest patch and visible X post", async () => {
  const t = convexTest(schema, modules)
  expect(await t.query(api.patchStore.newest.functionRef, {})).toEqual({
    patch: null,
    x: null,
  })
  await t.run(async (ctx) => {
    for (const [threadId, publishedAt] of [
      ["1", 100],
      ["2", 300],
    ] as const)
      await ctx.db.insert("patchThreads", {
        threadId,
        title: threadId,
        publishedAt,
        nextFetchAt: 0,
        leaseToken: "",
        lastError: "",
        fetchedAt: 0,
      })
    for (const [postId, publishedAt, hidden] of [
      ["a", 200, 0],
      ["b", 500, 1],
    ] as const)
      await ctx.db.insert("xPosts", {
        postId,
        accountId: "x",
        body: "",
        publishedAt,
        originalUrl: "",
        editIds: [],
        hidden,
        fetchedAt: 0,
      })
  })
  expect(await t.query(api.patchStore.newest.functionRef, {})).toEqual({
    patch: 300,
    x: 200,
  })
})
