import { z } from "zod"
import { publicQuery } from "../lib/crpc"
import {
  itemRowSchema,
  pairSchema,
  pointSchema,
  ANCHORS,
  DAY,
  LEAGUES,
  QUOTES,
  quotePoints,
  weightedPrice,
} from "../../shared/economy"
import type { Point } from "../../shared/economy"

export const overview = publicQuery
  .input(z.object({ league: z.enum(LEAGUES) }))
  .output(
    z
      .object({
        league: z.string(),
        hour: z.number(),
        prices: z.array(itemRowSchema),
        pairs: z.array(pairSchema),
        method: z.string(),
      })
      .nullable()
  )
  .query(async ({ ctx, input }) => {
    const snapshot = await ctx.orm.query.snapshots.findFirst({
      where: { league: input.league },
      orderBy: { hour: "desc" },
    })
    if (!snapshot) return null
    const chunks = await ctx.orm.query.pairSnapshots.findMany({
      where: { league: input.league, hour: snapshot.hour },
      orderBy: { chunk: "asc" },
      limit: 100,
    })
    return {
      league: snapshot.league,
      hour: snapshot.hour,
      prices: snapshot.prices,
      pairs: chunks.length ? chunks.flatMap((c) => c.pairs) : snapshot.pairs,
      method: snapshot.method,
    }
  })
export const itemHistory = publicQuery
  .input(
    z.object({
      league: z.enum(LEAGUES),
      item: z.string().max(240),
      quote: z.enum(QUOTES),
      days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]),
    })
  )
  .output(
    z.object({
      points: z.array(pointSchema),
      completedThrough: z.number().nullable(),
    })
  )
  .query(async ({ ctx, input }) => {
    const latest = await ctx.orm.query.snapshots.findFirst({
      where: { league: input.league },
      orderBy: { hour: "desc" },
    })
    if (!latest) return { points: [] as Point[], completedThrough: null }
    const cutoff = latest.hour - input.days * DAY
    const runs = await ctx.orm.query.imports.findMany({
      where: { hour: { gt: cutoff, lte: latest.hour } },
      limit: 2200,
    })
    const completed = new Set(
      runs.filter((r) => r.status === "complete").map((r) => r.hour)
    )
    const get = async (item: string) => {
      const rows = await ctx.orm.query.history.findMany({
        where: {
          league: input.league,
          item,
          day: { gte: Math.floor(cutoff / DAY) * DAY },
        },
        limit: 92,
      })
      return rows
        .flatMap((r) => r.points)
        .filter(
          (p) => p[0] > cutoff && p[0] <= latest.hour && completed.has(p[0])
        )
        .sort((a, b) => a[0] - b[0])
    }
    const points = quotePoints(
      await get(input.item),
      input.quote === "Exalted" ? [] : await get(ANCHORS[input.quote]),
      input.quote
    )
    if (input.days <= 7) return { points, completedThrough: latest.hour }
    const days = new Map<number, Point[]>()
    for (const p of points) {
      const day = Math.floor(p[0] / DAY) * DAY
      days.set(day, [...(days.get(day) ?? []), p])
    }
    return {
      points: [...days].flatMap(([t, ps]) => {
        const value = weightedPrice(ps)
        return value === null
          ? []
          : [[t, value, ps.reduce((sum, p) => sum + p[2], 0), 0] as Point]
      }),
      completedThrough: latest.hour,
    }
  })
