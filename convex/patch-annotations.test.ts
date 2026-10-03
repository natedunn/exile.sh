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

const { list, save, remove, merge } = api.patchAnnotations

const mark = (id: string, start = 0, note = "") => ({
  id,
  start,
  end: start + 5,
  quote: "Spark",
  note,
  createdAt: 1,
})

test("patch annotation endpoints reject anonymous and pending callers", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(list.functionRef, { threadId: "1" })).rejects.toThrow(
    "Sign in"
  )
  await expect(
    t.mutation(save.functionRef, { threadId: "1", annotation: mark("a") })
  ).rejects.toThrow("Sign in")
  const pending = await signIn(t, "pending@example.com", false)
  await expect(
    pending.mutation(merge.functionRef, {
      annotations: [{ threadId: "1", annotation: mark("a") }],
    })
  ).rejects.toThrow("Create your exile.sh account")
})

test("notes save idempotently, per thread and per account", async () => {
  const t = convexTest(schema, modules)
  const first = await signIn(t, "first@example.com")
  const second = await signIn(t, "second@example.com")
  await first.mutation(save.functionRef, {
    threadId: "1",
    annotation: mark("b", 20),
  })
  await first.mutation(save.functionRef, {
    threadId: "1",
    annotation: mark("a", 3),
  })
  await first.mutation(save.functionRef, {
    threadId: "1",
    annotation: mark("a", 3, "Check this on stream"),
  })
  await first.mutation(save.functionRef, {
    threadId: "2",
    annotation: mark("c"),
  })
  expect(await first.query(list.functionRef, { threadId: "1" })).toEqual([
    mark("a", 3, "Check this on stream"),
    mark("b", 20),
  ])
  expect(await second.query(list.functionRef, { threadId: "1" })).toEqual([])
  await second.mutation(remove.functionRef, { threadId: "1", id: "a" })
  await first.mutation(remove.functionRef, { threadId: "1", id: "a" })
  expect(await first.query(list.functionRef, { threadId: "1" })).toEqual([
    mark("b", 20),
  ])
})

test("empty notes and malformed threads are refused", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "bad@example.com")
  await expect(
    user.mutation(save.functionRef, {
      threadId: "1",
      annotation: { ...mark("a"), end: 0 },
    })
  ).rejects.toThrow()
  await expect(
    user.mutation(save.functionRef, {
      threadId: "../1",
      annotation: mark("a"),
    })
  ).rejects.toThrow()
})

test("merging browser notes keeps the account's copy", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "merge@example.com")
  await user.mutation(save.functionRef, {
    threadId: "1",
    annotation: mark("a", 0, "account"),
  })
  expect(
    await user.mutation(merge.functionRef, {
      annotations: [
        { threadId: "1", annotation: mark("a", 0, "browser") },
        { threadId: "1", annotation: mark("b", 10) },
        { threadId: "1", annotation: mark("b", 10) },
        { threadId: "2", annotation: mark("c") },
      ],
    })
  ).toEqual({ added: 2 })
  expect(await user.query(list.functionRef, { threadId: "1" })).toEqual([
    mark("a", 0, "account"),
    mark("b", 10),
  ])
  expect(await user.query(list.functionRef, { threadId: "2" })).toEqual([
    mark("c"),
  ])
})
