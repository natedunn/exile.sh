/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest"
import { convexTest } from "convex-test"
import schema from "./functions/schema"
import { internal } from "./functions/_generated/api"
import { HOUR, DAY } from "../shared/economy"
import type { FunctionArgs } from "convex/server"
import type { ActionCtx } from "./functions/_generated/server"
// Generated kitcn callers use CommonJS require, unavailable in Vitest's TS module
// loader. Only replace transport; execute the real queries/mutations/actions.
vi.mock("./functions/generated/store.runtime", () => ({
  createStoreCaller: (ctx: ActionCtx) => ({
    state: () => ctx.runQuery(internal.store.state, {}),
    imported: (args: { hour: number }) =>
      ctx.runQuery(internal.store.imported, args),
    acquire: (args: { hour: number; token: string }) =>
      ctx.runMutation(internal.store.acquire, args),
    release: (args: {
      token: string
      cursor: number
      nextAllowedAt: number
      error: string
    }) => ctx.runMutation(internal.store.release, args),
    begin: (args: FunctionArgs<typeof internal.store.begin>) =>
      ctx.runMutation(internal.store.begin, args),
    writeChunk: (args: FunctionArgs<typeof internal.store.writeChunk>) =>
      ctx.runMutation(internal.store.writeChunk, args),
    publish: (args: FunctionArgs<typeof internal.store.publish>) =>
      ctx.runMutation(internal.store.publish, args),
  }),
}))
vi.mock("./functions/generated/ingestion.runtime", () => ({
  createIngestionCaller: (ctx: ActionCtx) => ({
    schedule: {
      after: (delay: number) => ({
        ingest: (args: { hour?: number; remaining?: number }) =>
          ctx.scheduler.runAfter(delay, internal.ingestion.ingest, args),
      }),
    },
  }),
}))
const modules = import.meta.glob("./functions/**/*.ts")
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function setup() {
  vi.useFakeTimers()
  vi.stubEnv("COLLECTOR_ENABLED", "true")
  const at = Math.floor(Date.now() / 1000 / HOUR) * HOUR - HOUR
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify({
          next_change_id: Number(url.split("/").at(-1)) + HOUR,
          markets: [],
        }),
        { status: 200 }
      )
  )
  vi.stubGlobal("fetch", fetcher)
  return { t: convexTest(schema, modules), at, fetcher }
}
test("cold startup imports 30 hours through scheduled continuations; redeploy does not refetch", async () => {
  const { t, at, fetcher } = setup()
  expect(await t.action(internal.ingestion.ingest, {})).toMatchObject({
    status: "complete",
    hour: at - 29 * HOUR,
  })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(30)
  expect((await t.query(internal.store.state, {}))?.cursor).toBe(at + HOUR)
  expect(await t.action(internal.ingestion.ingest, {})).toMatchObject({
    status: "caught-up",
  })
  expect(fetcher).toHaveBeenCalledTimes(30)
})
test("queued automatic work honors pause and resumes from its cursor", async () => {
  const { t, fetcher } = setup()
  await t.action(internal.ingestion.ingest, {})
  vi.stubEnv("COLLECTOR_ENABLED", "false")
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(1)
  vi.stubEnv("COLLECTOR_ENABLED", "true")
  await t.action(internal.ingestion.ingest, { remaining: 2 })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(3)
})
test("outages older than the import window recover a bounded batch instead of throwing forever", async () => {
  const { t, at, fetcher } = setup()
  await t.mutation(internal.store.acquire, {
    hour: at - 12 * DAY,
    token: "fixture",
  })
  await t.mutation(internal.store.release, {
    token: "fixture",
    cursor: at - 12 * DAY,
    nextAllowedAt: 0,
    error: "",
  })
  expect(
    await t.action(internal.ingestion.ingest, { remaining: 2 })
  ).toMatchObject({ status: "complete", hour: at - 8 * DAY })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(2)
})

test("automatic catch-up caps each batch at 48 hours", async () => {
  const { t, at, fetcher } = setup()
  await t.mutation(internal.store.acquire, {
    hour: at - 80 * HOUR,
    token: "fixture",
  })
  await t.mutation(internal.store.release, {
    token: "fixture",
    cursor: at - 80 * HOUR,
    nextAllowedAt: 0,
    error: "",
  })
  await t.action(internal.ingestion.ingest, {})
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(48)
  expect((await t.query(internal.store.state, {}))?.cursor).toBe(at - 32 * HOUR)
})

test("end of upstream history waits for the next boundary without advancing or retrying", async () => {
  const { t, at, fetcher } = setup()
  fetcher.mockImplementation(
    async (url: string) =>
      new Response(
        JSON.stringify({
          next_change_id: Number(url.split("/").at(-1)),
          markets: [],
        }),
        { status: 200 }
      )
  )
  expect(await t.action(internal.ingestion.ingest, {})).toMatchObject({
    status: "caught-up",
  })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(5000))
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect((await t.query(internal.store.state, {}))?.nextAllowedAt).toBe(
    (at + 2 * HOUR) * 1000
  )
})
