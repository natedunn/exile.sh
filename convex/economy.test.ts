/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import schema from "./functions/schema"
import { api, internal } from "./functions/_generated/api"
import { ANCHORS, HOUR } from "../shared/economy"
const modules = import.meta.glob("./functions/**/*.ts")
const price = { id: ANCHORS.Divine, price: 200, volume: 50, direct: true }

test("partial hours stay private; a replay cannot duplicate history or regress the current snapshot", async () => {
  const t = convexTest(schema, modules)
  const hour = 100 * HOUR
  await t.mutation(internal.store.begin, {
    hour,
    hash: "one",
    archive: "fixture",
    bytes: 1,
    marketCount: 1,
    expectedChunks: 1,
  })
  expect(await t.query(api.economy.overview, { league: "Standard" })).toBeNull()
  await expect(
    t.mutation(internal.store.publish, {
      hour,
      leagues: [{ league: "Standard", prices: [price], pairs: [] }],
    })
  ).rejects.toThrow("Incomplete")
  const chunk = { hour, chunk: 0, league: "Standard", prices: [price] }
  await t.mutation(internal.store.writeChunk, chunk)
  await t.mutation(internal.store.writeChunk, chunk)
  await t.mutation(internal.store.publish, {
    hour,
    leagues: [{ league: "Standard", prices: [price], pairs: [] }],
  })
  const history = await t.query(api.economy.itemHistory, {
    league: "Standard",
    item: price.id,
    quote: "Exalted",
    days: 1,
  })
  expect(history.points).toEqual([[hour, 200, 50, 1]])
  await t.mutation(internal.store.begin, {
    hour: hour - HOUR,
    hash: "earlier",
    archive: "fixture",
    bytes: 1,
    marketCount: 1,
    expectedChunks: 1,
  })
  await t.mutation(internal.store.writeChunk, { ...chunk, hour: hour - HOUR })
  const during = await t.query(api.economy.itemHistory, {
    league: "Standard",
    item: price.id,
    quote: "Exalted",
    days: 1,
  })
  expect(during.points).toHaveLength(1)
  await t.mutation(internal.store.publish, {
    hour: hour - HOUR,
    leagues: [{ league: "Standard", prices: [price], pairs: [] }],
  })
  expect(
    (await t.query(api.economy.overview, { league: "Standard" }))?.hour
  ).toBe(hour)
  expect(
    (
      await t.query(api.economy.itemHistory, {
        league: "Hardcore",
        item: price.id,
        quote: "Exalted",
        days: 1,
      })
    ).points
  ).toHaveLength(0)
})

test("collector lease serializes fetches and rejects release by another worker", async () => {
  const t = convexTest(schema, modules)
  expect(
    await t.mutation(internal.store.acquire, { hour: HOUR, token: "a" })
  ).toBe(true)
  expect(
    await t.mutation(internal.store.acquire, { hour: HOUR, token: "b" })
  ).toBe(false)
  await t.mutation(internal.store.release, {
    token: "b",
    cursor: 999,
    nextAllowedAt: 0,
    error: "",
  })
  expect((await t.query(internal.store.state, {}))?.leaseToken).toBe("a")
  await t.mutation(internal.store.release, {
    token: "a",
    cursor: 2 * HOUR,
    nextAllowedAt: 0,
    error: "",
  })
  expect(
    await t.mutation(internal.store.acquire, { hour: HOUR, token: "b" })
  ).toBe(true)
})

test("retention deletes expired history and its archive while preserving current imports", async () => {
  const t = convexTest(schema, modules)
  const nowHour = Math.floor(Date.now() / 1000 / HOUR) * HOUR
  const oldHour = nowHour - 11 * 24 * HOUR
  const archive = await t.run(
    async (ctx) => await ctx.storage.store(new Blob(["fixture"]))
  )
  await t.mutation(internal.store.begin, {
    hour: oldHour,
    hash: "expired",
    archive,
    bytes: 7,
    marketCount: 1,
    expectedChunks: 1,
  })
  await t.mutation(internal.store.writeChunk, {
    hour: oldHour,
    chunk: 0,
    league: "Standard",
    prices: [price],
  })
  await t.mutation(internal.store.begin, {
    hour: nowHour,
    hash: "current",
    archive: "not-deleted",
    bytes: 1,
    marketCount: 0,
    expectedChunks: 0,
  })
  expect(await t.mutation(internal.store.cleanup, {})).toEqual({
    historyDeleted: 1,
    archivesDeleted: 1,
  })
  expect(await t.run(async (ctx) => await ctx.storage.get(archive))).toBeNull()
  expect(
    await t.query(internal.store.imported, { hour: nowHour })
  ).not.toBeNull()
})
