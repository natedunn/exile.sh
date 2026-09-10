/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import schema from "./functions/schema"
import { api, internal } from "./functions/_generated/api"
import { MOVER_PERIOD, MOVER_PERIODS } from "../shared/movers"
import type { Point } from "../shared/economy"
import { ANCHORS, DAY, HOUR } from "../shared/economy"
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
  const oldHour = nowHour - 95 * 24 * HOUR
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

for (const period of MOVER_PERIODS.filter((p) => p !== "24h")) {
  test(`movers calculate ${period} windows and quote changes from completed history`, async () => {
    const t = convexTest(schema, modules)
    const at = 200 * DAY + 20 * HOUR
    const end = at - MOVER_PERIOD[period].seconds
    const item = "fixture-currency"
    const ids = [item, ANCHORS.Chaos, ANCHORS.Divine]
    const current = [100, 20, 200],
      previous = [50, 10, 200]
    await t.run(async (ctx) => {
      await ctx.db.insert("snapshots", {
        league: "Standard",
        hour: at,
        method: "fixture",
        pairs: [],
        prices: ids.map((id, i) => ({
          id,
          price: current[i],
          volume: 30,
          direct: true,
          changes: [null, null, null],
          changes7: [null, null, null],
          eligible: [false, false, false],
          trends: [[], [], []],
        })),
      })
      const hours = [
        ...Array.from({ length: 24 }, (_, i) => at - i * HOUR),
        end,
        end - HOUR,
        end - 2 * HOUR,
      ]
      for (const hour of hours)
        await ctx.db.insert("imports", {
          hour,
          status: "complete",
          hash: "fixture",
          archive: "",
          marketCount: 3,
          bytes: 0,
          completedChunks: [],
          expectedChunks: 0,
        })
      for (const [i, id] of ids.entries()) {
        const days = new Map<number, number[][]>()
        for (const hour of hours) {
          const day = Math.floor(hour / DAY) * DAY
          days.set(day, [
            ...(days.get(day) ?? []),
            [hour, hour <= end ? previous[i] : current[i], 30, 1],
          ])
        }
        for (const [day, points] of days)
          await ctx.db.insert("history", {
            league: "Standard",
            item: id,
            day,
            points,
          })
      }
      // A processing hour must not pollute either weighted price or liquidity.
      const day = Math.floor(end / DAY) * DAY
      const row = await ctx.db
        .query("history")
        .withIndex("item_day", (q) =>
          q.eq("league", "Standard").eq("item", item).eq("day", day)
        )
        .unique()
      const run = await ctx.db
        .query("imports")
        .withIndex("hour", (q) => q.eq("hour", end - HOUR))
        .unique()
      await ctx.db.patch("imports", run!._id, { status: "processing" })
      await ctx.db.patch("history", row!._id, {
        points: row!.points.map((p: Point) =>
          p[0] === end - HOUR ? [p[0], 999999, 999999, 1] : p
        ),
      })
    })
    const result = await t.query(api.economy.movers, {
      league: "Standard",
      period,
    })
    expect(result?.hasComparison).toBe(true)
    const row = result?.rows.find((r) => r.id === item)
    expect(row?.changes).toEqual([100, 0, 100])
    expect(row?.eligible).toEqual([true, true, true])
    expect(
      await t.query(api.economy.movers, { league: "Hardcore", period })
    ).toBeNull()
  })
}

test("movers return an explicit missing-history result instead of substituting another period", async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    await ctx.db.insert("snapshots", {
      league: "Standard",
      hour: 200 * DAY,
      method: "fixture",
      pairs: [],
      prices: [],
    })
  })
  const result = await t.query(api.economy.movers, {
    league: "Standard",
    period: "90d",
  })
  expect(result).toMatchObject({
    period: "90d",
    hasComparison: false,
    rows: [],
  })
})

test("raw archives expire before price history and the completion ledger", async () => {
  const t = convexTest(schema, modules)
  const hour = Math.floor(Date.now() / 1000 / DAY) * DAY - 11 * DAY
  const archive = await t.run((ctx) => ctx.storage.store(new Blob(["fixture"])))
  await t.run(async (ctx) => {
    await ctx.db.insert("imports", {
      hour,
      status: "complete",
      hash: "fixture",
      archive,
      marketCount: 1,
      bytes: 1,
      completedChunks: [],
      expectedChunks: 0,
    })
    await ctx.db.insert("history", {
      league: "Standard",
      item: price.id,
      day: hour,
      points: [[hour, 200, 50, 1]],
    })
  })
  expect(await t.mutation(internal.store.cleanup, {})).toEqual({
    historyDeleted: 0,
    archivesDeleted: 1,
  })
  expect(await t.run((ctx) => ctx.storage.get(archive))).toBeNull()
  expect(await t.query(internal.store.imported, { hour })).toMatchObject({
    status: "complete",
    archive: "",
  })
  expect(await t.mutation(internal.store.cleanup, {})).toEqual({
    historyDeleted: 0,
    archivesDeleted: 0,
  })
})
