/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest"
import { convexTest } from "convex-test"
import { internal } from "./functions/_generated/api"
import { api } from "./shared/api"
import schema from "./functions/schema"
const modules = import.meta.glob("./functions/**/*.ts")
afterEach(() => vi.useRealTimers())

test("persists notes across reads, throttles imports, and keeps last good content after failure", async () => {
  vi.useFakeTimers()
  const now = Date.UTC(2026, 8, 12)
  vi.setSystemTime(now)
  const t = convexTest(schema, modules)
  const threadId = "4000864"
  const item = { threadId, title: "0.5.5 Patch Notes", publishedAt: now }
  await t.mutation(internal.patchStore.discover, { items: [item] })
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "a" })
  ).toBe(true)
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "b" })
  ).toBe(false)
  const post = { title: item.title, html: "<ul><li>Saved fix</li></ul>" }
  await t.mutation(internal.patchStore.finish, {
    threadId,
    token: "a",
    post,
    error: "",
  })
  await t.mutation(internal.patchStore.discover, { items: [item] })
  expect(
    (await t.query(api.patchStore.latest.functionRef, {})).items
  ).toHaveLength(1)
  expect(await t.query(api.patchStore.post.functionRef, { threadId })).toEqual({
    ...post,
    date: now,
  })
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "b" })
  ).toBe(false)
  vi.setSystemTime(now + 6 * 3_600_000)
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "b" })
  ).toBe(true)
  await t.mutation(internal.patchStore.finish, {
    threadId,
    token: "a",
    post: { ...post, html: "outdated worker" },
    error: "",
  })
  await t.mutation(internal.patchStore.finish, {
    threadId,
    token: "b",
    error: "HTTP 503",
  })
  expect(await t.query(api.patchStore.post.functionRef, { threadId })).toEqual({
    ...post,
    date: now,
  })
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "c" })
  ).toBe(false)
  vi.setSystemTime(now + 7 * 3_600_000)
  expect(
    await t.mutation(internal.patchStore.acquire, { threadId, token: "c" })
  ).toBe(true)
})
