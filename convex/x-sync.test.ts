/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest"
import { convexTest } from "convex-test"
import type { FunctionArgs } from "convex/server"
import type { ActionCtx } from "./functions/_generated/server"
import { internal } from "./functions/_generated/api"
import { api } from "./shared/api"
import schema from "./functions/schema"
import { X_DAY, X_FAST, X_HOUR, newestXId } from "../shared/x-sync"

vi.mock("./functions/generated/xStore.runtime", () => ({
  createXStoreCaller: (ctx: ActionCtx) => ({
    acquire: (args: FunctionArgs<typeof internal.xStore.acquire>) =>
      ctx.runMutation(internal.xStore.acquire, args),
    rememberAccount: (
      args: FunctionArgs<typeof internal.xStore.rememberAccount>
    ) => ctx.runMutation(internal.xStore.rememberAccount, args),
    savePage: (args: FunctionArgs<typeof internal.xStore.savePage>) =>
      ctx.runMutation(internal.xStore.savePage, args),
    release: (args: FunctionArgs<typeof internal.xStore.release>) =>
      ctx.runMutation(internal.xStore.release, args),
  }),
}))
const modules = import.meta.glob("./functions/**/*.ts")
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const now = Date.UTC(2026, 8, 14, 12)
const post = (id: string, date = now - 2 * X_DAY) => ({
  id,
  text: `Post ${id}`,
  created_at: new Date(date).toISOString(),
  edit_history_tweet_ids: [id],
})
const timeline = (posts: ReturnType<typeof post>[], next?: string) =>
  Response.json({
    data: posts,
    meta: { result_count: posts.length, ...(next ? { next_token: next } : {}) },
  })
function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubEnv("X_BEARER_TOKEN", "test-token")
  vi.stubEnv("X_POLL_ENABLED", "true")
  const fetcher = vi.fn(async (url: string) =>
    url.includes("by/username")
      ? Response.json({ data: { id: "42" } })
      : timeline([post("100")])
  )
  vi.stubGlobal("fetch", fetcher)
  return { t: convexTest(schema, modules), fetcher }
}

test("one-time seed is persisted, public reads make no X calls, normal ticks skip until hourly due time", async () => {
  const { t, fetcher } = setup()
  expect(await t.action(internal.xIngestion.poll, {})).toEqual({
    status: "complete",
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect((await t.query(api.xStore.latest.functionRef, {})).posts[0].id).toBe(
    "100"
  )
  expect((await t.query(internal.xStore.state, {}))?.nextPollAt).toBe(
    now + X_HOUR
  )
  vi.setSystemTime(now + X_FAST)
  expect(await t.action(internal.xIngestion.poll, {})).toEqual({
    status: "not-due",
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
  vi.setSystemTime(now + X_HOUR)
  fetcher.mockImplementation(async () => timeline([]))
  await t.action(internal.xIngestion.poll, {})
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain("since_id=100")
  expect((await t.query(api.xStore.latest.functionRef, {})).posts).toHaveLength(
    1
  )
  expect(fetcher).toHaveBeenCalledTimes(3)
})

test("new activity uses fast polling for 24 hours and returns to hourly when quiet", async () => {
  const { t, fetcher } = setup()
  await t.action(internal.xIngestion.poll, {})
  vi.setSystemTime(now + X_HOUR)
  fetcher.mockImplementation(async () => timeline([post("200", now + X_HOUR)]))
  await t.action(internal.xIngestion.poll, {})
  expect((await t.query(internal.xStore.state, {}))?.nextPollAt).toBe(
    now + X_HOUR + X_FAST
  )
  vi.setSystemTime(now + X_HOUR + X_DAY)
  fetcher.mockImplementation(async () => timeline([]))
  await t.action(internal.xIngestion.poll, {})
  expect((await t.query(internal.xStore.state, {}))?.nextPollAt).toBe(
    now + X_DAY + 2 * X_HOUR
  )
})

test("failed pagination resumes its checkpoint without advancing the cursor or duplicating posts", async () => {
  const { t, fetcher } = setup()
  await t.action(internal.xIngestion.poll, {})
  vi.setSystemTime(now + X_HOUR)
  fetcher.mockImplementation(async (url) =>
    url.includes("pagination_token")
      ? new Response("failure", { status: 503 })
      : timeline([post("300")], "next-page")
  )
  expect(await t.action(internal.xIngestion.poll, {})).toEqual({
    status: "backoff",
  })
  expect(await t.query(internal.xStore.state, {})).toMatchObject({
    newestId: "100",
    pendingNewestId: "300",
    paginationToken: "next-page",
    failures: 1,
  })
  vi.setSystemTime(now + X_HOUR + X_FAST)
  fetcher.mockImplementation(async () => timeline([post("300"), post("200")]))
  await t.action(internal.xIngestion.poll, {})
  const requested = fetcher.mock.calls.at(-1)?.[0]
  expect(requested).toContain("since_id=100")
  expect(requested).toContain("pagination_token=next-page")
  expect(await t.query(internal.xStore.state, {})).toMatchObject({
    newestId: "300",
    pendingNewestId: "",
    paginationToken: "",
    failures: 0,
  })
  expect((await t.query(api.xStore.latest.functionRef, {})).posts).toHaveLength(
    3
  )
})

test("leases exclude overlapping jobs and reject stale writes", async () => {
  const { t } = setup()
  expect(
    await t.mutation(internal.xStore.acquire, { token: "first" })
  ).not.toBeNull()
  expect(
    await t.mutation(internal.xStore.acquire, { token: "second" })
  ).toBeNull()
  vi.setSystemTime(now + 6 * 60_000)
  expect(
    await t.mutation(internal.xStore.acquire, { token: "second" })
  ).not.toBeNull()
  expect(
    await t.mutation(internal.xStore.rememberAccount, {
      token: "first",
      accountId: "42",
    })
  ).toBe(false)
  expect(
    await t.mutation(internal.xStore.savePage, {
      token: "first",
      posts: [post("100")],
      nextToken: "",
    })
  ).toBe(false)
})

test("rate limits respect retry-after, preserve saved data, and paused collectors make no calls", async () => {
  const { t, fetcher } = setup()
  await t.action(internal.xIngestion.poll, {})
  vi.setSystemTime(now + X_HOUR)
  fetcher.mockImplementation(
    async () =>
      new Response("secret upstream body", {
        status: 429,
        headers: { "retry-after": "7200" },
      })
  )
  await t.action(internal.xIngestion.poll, {})
  expect(await t.query(internal.xStore.state, {})).toMatchObject({
    nextPollAt: now + 3 * X_HOUR,
    newestId: "100",
    lastError: "X API returned 429",
  })
  expect((await t.query(api.xStore.latest.functionRef, {})).posts).toHaveLength(
    1
  )
  vi.stubEnv("X_POLL_ENABLED", "false")
  expect(await t.action(internal.xIngestion.poll, {})).toEqual({
    status: "paused",
  })
  expect(fetcher).toHaveBeenCalledTimes(3)
})

test("administrative hiding and edit history remove superseded posts from the sidebar", async () => {
  const { t, fetcher } = setup()
  await t.action(internal.xIngestion.poll, {})
  vi.setSystemTime(now + X_HOUR)
  fetcher.mockImplementation(async () =>
    timeline([{ ...post("200"), edit_history_tweet_ids: ["100", "200"] }])
  )
  await t.action(internal.xIngestion.poll, {})
  expect(
    (await t.query(api.xStore.latest.functionRef, {})).posts.map((p) => p.id)
  ).toEqual(["200"])
  await t.mutation(internal.xStore.hide, { postId: "200", hidden: true })
  expect((await t.query(api.xStore.latest.functionRef, {})).posts).toEqual([])
})

test("snowflake cursors preserve integer precision", () => {
  expect(newestXId("2098245162606411828", "2098245162606411829", "100")).toBe(
    "2098245162606411829"
  )
})
