/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { expect, test } from "vitest"
import { api, internal } from "./functions/_generated/api"
import schema from "./functions/schema"
import { ANCHORS, DAY, HOUR } from "../shared/economy"
import { MOVER_PERIODS } from "../shared/movers"

const modules = import.meta.glob("./functions/**/*.ts")

test("the lightweight seed exercises economy views and never overwrites existing data", async () => {
  const t = convexTest(schema, modules)
  const now = (200 * DAY + 21 * HOUR) * 1000

  const seeded = await t.mutation(internal.seed.local, { now })
  expect(seeded).toMatchObject({
    seeded: true,
    leagues: 2,
    items: 13,
    completedHours: 42,
  })

  const overview = await t.query(api.economy.overview, {
    league: "Forbidden Rites",
  })
  expect(overview).toMatchObject({
    league: "Forbidden Rites",
    method: "executed-volume-v1-synthetic-seed-v1",
  })
  expect(overview?.prices).toHaveLength(13)
  expect(overview?.pairs).toHaveLength(12)

  for (const period of MOVER_PERIODS) {
    const movers = await t.query(api.economy.movers, {
      league: "Forbidden Rites",
      period,
    })
    expect(movers?.hasComparison, period).toBe(true)
    expect(movers?.rows, period).toHaveLength(13)
    expect(
      movers?.rows.some((row) => row.eligible.some(Boolean)),
      period
    ).toBe(true)
  }

  const chart = await t.query(api.economy.itemHistory, {
    league: "Forbidden Rites",
    item: ANCHORS.Divine,
    quote: "Exalted",
    days: 90,
  })
  expect(chart.points.length).toBeGreaterThan(5)
  expect(
    await t.query(api.economy.overview, { league: "HC Forbidden Rites" })
  ).toBeNull()

  const before = await t.run((ctx) => ctx.db.query("history").take(500))
  expect(
    await t.mutation(internal.seed.local, { now: now + DAY * 1000 })
  ).toEqual({ seeded: false, reason: "economy-data-exists" })
  const after = await t.run((ctx) => ctx.db.query("history").take(500))
  expect(after).toHaveLength(before.length)
})
