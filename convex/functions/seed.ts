import { z } from "zod"
import { privateMutation } from "../lib/crpc"
import {
  ANCHORS,
  DAY,
  HOUR,
  METHOD,
  QUOTES,
  change,
  eligibleMover,
  quotePoints,
  weightedPrice,
} from "../../shared/economy"
import { MOVER_PERIOD } from "../../shared/movers"
import { history, imports, pairSnapshots, snapshots } from "./schema"
import type { ItemRow, Pair, Point } from "../../shared/economy"

const SEED_METHOD = `${METHOD}-synthetic-seed-v1`
const SEED_LEAGUES = ["Forbidden Rites", "Standard"] as const
const SEED_ITEMS = [
  {
    id: ANCHORS.Exalted,
    price: 1,
    volume: 8_000,
    dailyGrowth: 0,
  },
  {
    id: ANCHORS.Chaos,
    price: 0.075,
    volume: 30_000,
    dailyGrowth: 0.001,
  },
  {
    id: ANCHORS.Divine,
    price: 132,
    volume: 120,
    dailyGrowth: 0.002,
  },
  {
    id: "Metadata/Items/Currency/CurrencyUpgradeToRare",
    price: 0.42,
    volume: 8_000,
    dailyGrowth: 0.004,
  },
  {
    id: "Metadata/Items/Currency/CurrencyCorrupt",
    price: 0.7,
    volume: 5_000,
    dailyGrowth: -0.003,
  },
  {
    id: "Metadata/Items/Currency/CurrencyUpgradeRandomly",
    price: 1.8,
    volume: 2_000,
    dailyGrowth: 0.006,
  },
  {
    id: "Metadata/Items/Currency/CurrencyUpgradeMagicToRare",
    price: 0.9,
    volume: 3_000,
    dailyGrowth: -0.002,
  },
  {
    id: "Metadata/Items/Currency/CurrencyAddEquipmentSocket",
    price: 18,
    volume: 180,
    dailyGrowth: 0.008,
  },
  {
    id: "Metadata/Items/Currency/CurrencyGemQuality",
    price: 6.5,
    volume: 600,
    dailyGrowth: -0.005,
  },
  {
    id: "Metadata/Items/Currency/CurrencyDuplicate",
    price: 4_500,
    volume: 3,
    dailyGrowth: 0.003,
  },
  {
    id: "Metadata/Items/Currency/CurrencyRemoveMod",
    price: 22,
    volume: 120,
    dailyGrowth: -0.007,
  },
  {
    id: "Metadata/Items/Currency/CurrencyAddSkillGemSocket3",
    price: 4.2,
    volume: 900,
    dailyGrowth: 0.005,
  },
] as const

function seedHours(at: number) {
  const hours = new Set<number>()
  for (let offset = 0; offset <= 24; offset += 1) hours.add(at - offset * HOUR)
  for (const { seconds } of Object.values(MOVER_PERIOD)) {
    for (let offset = 0; offset < 3; offset += 1) {
      hours.add(at - seconds - offset * HOUR)
    }
  }
  for (const days of [3, 14, 60]) hours.add(at - days * DAY)
  return [...hours].sort((a, b) => a - b)
}

function itemPoints(
  item: (typeof SEED_ITEMS)[number],
  hours: number[],
  at: number,
  leagueIndex: number
): Point[] {
  const leagueFactor = 1 + leagueIndex * 0.12
  return hours.map((hour, index) => {
    const ageInDays = (hour - at) / DAY
    const price =
      item.price * leagueFactor * Math.exp(item.dailyGrowth * ageInDays)
    const volume = Math.round(item.volume * (1 + (index % 4) * 0.04))
    return [hour, price, volume, 1]
  })
}

function snapshotRows(byItem: Map<string, Point[]>, at: number): ItemRow[] {
  return SEED_ITEMS.map((item) => {
    const points = byItem.get(item.id) ?? []
    const series = QUOTES.map((quote) =>
      quotePoints(points, byItem.get(ANCHORS[quote]) ?? [], quote)
    )
    return {
      id: item.id,
      price: points.at(-1)?.[1] ?? item.price,
      volume: points.at(-1)?.[2] ?? item.volume,
      direct: true,
      changes: series.map((values) => change(values, at, DAY)),
      changes7: series.map((values) => change(values, at, 7 * DAY)),
      eligible: series.map(
        (values, index) =>
          item.id !== ANCHORS[QUOTES[index]] &&
          change(values, at, DAY) !== null &&
          eligibleMover(points, at)
      ),
      trends: series.map((values) =>
        Array.from({ length: 8 }, (_, index) => {
          const end = at - (7 - index) * 6 * HOUR
          return weightedPrice(
            values.filter(
              (point) => point[0] <= end && point[0] > end - 6 * HOUR
            )
          )
        })
      ),
    }
  })
}

function snapshotPairs(rows: ItemRow[]): Pair[] {
  return rows
    .filter((row) => row.id !== ANCHORS.Exalted)
    .map((row) => ({
      id: `${row.id}|${ANCHORS.Exalted}`,
      a: row.id,
      b: ANCHORS.Exalted,
      va: row.volume,
      vb: Math.max(1, Math.round(row.volume * row.price)),
      sa: Math.max(1, Math.round(row.volume / 3)),
      sb: Math.max(1, Math.round((row.volume * row.price) / 3)),
    }))
}

export const local = privateMutation
  .input(z.object({ now: z.number().int().optional() }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.snapshots.findFirst({
      orderBy: { hour: "desc" },
    })
    if (existing) {
      return { seeded: false, reason: "economy-data-exists" as const }
    }

    const now = input.now ?? Date.now()
    const at = Math.floor(now / 1000 / HOUR) * HOUR - HOUR
    const hours = seedHours(at)

    for (const hour of hours) {
      await ctx.orm.insert(imports).values({
        hour,
        status: "complete",
        hash: `${SEED_METHOD}:${hour}`,
        archive: "",
        marketCount: SEED_ITEMS.length,
        bytes: 0,
        completedChunks: [],
        expectedChunks: 0,
      })
    }

    let historyRows = 0
    for (const [leagueIndex, league] of SEED_LEAGUES.entries()) {
      const byItem = new Map<string, Point[]>()
      for (const item of SEED_ITEMS) {
        const points = itemPoints(item, hours, at, leagueIndex)
        byItem.set(item.id, points)
        const byDay = new Map<number, Point[]>()
        for (const point of points) {
          const day = Math.floor(point[0] / DAY) * DAY
          byDay.set(day, [...(byDay.get(day) ?? []), point])
        }
        for (const [day, dayPoints] of byDay) {
          await ctx.orm.insert(history).values({
            league,
            item: item.id,
            day,
            points: dayPoints,
          })
          historyRows += 1
        }
      }

      const prices = snapshotRows(byItem, at)
      const pairs = snapshotPairs(prices)
      await ctx.orm.insert(snapshots).values({
        league,
        hour: at,
        prices,
        pairs: [],
        method: SEED_METHOD,
      })
      await ctx.orm.insert(pairSnapshots).values({
        league,
        hour: at,
        chunk: 0,
        pairs,
      })
    }

    return {
      seeded: true,
      leagues: SEED_LEAGUES.length,
      items: SEED_ITEMS.length,
      completedHours: hours.length,
      historyRows,
    }
  })
