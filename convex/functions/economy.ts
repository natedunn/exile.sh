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
import {
  MOVER_PERIODS,
  MOVER_PERIOD,
  COMPARISON_WINDOW,
  moverMetrics,
} from "../../shared/movers"
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

export const movers = publicQuery
  .input(z.object({ league: z.enum(LEAGUES), period: z.enum(MOVER_PERIODS) }))
  .output(
    z
      .object({
        hour: z.number(),
        period: z.enum(MOVER_PERIODS),
        hasComparison: z.boolean(),
        rows: z.array(
          z.object({
            id: z.string(),
            changes: z.array(z.number().nullable()),
            eligible: z.array(z.boolean()),
          })
        ),
      })
      .nullable()
  )
  .query(async ({ ctx, input }) => {
    const snapshot = await ctx.orm.query.snapshots.findFirst({
      where: { league: input.league },
      orderBy: { hour: "desc" },
    })
    if (!snapshot) return null
    if (input.period === "24h")
      return {
        hour: snapshot.hour,
        period: input.period,
        hasComparison: snapshot.prices.some((row) =>
          row.changes.some((value) => value !== null)
        ),
        rows: snapshot.prices.map(({ id, changes, eligible }) => ({
          id,
          changes,
          eligible,
        })),
      }
    const offset = MOVER_PERIOD[input.period].seconds
    const oldEnd = snapshot.hour - offset
    const windows = [
      [snapshot.hour - DAY, snapshot.hour],
      [oldEnd - COMPARISON_WINDOW, oldEnd],
    ]
    const runs = (
      await Promise.all(
        windows.map(([start, end]) =>
          ctx.orm.query.imports.findMany({
            where: { hour: { gt: start, lte: end } },
            limit: 25,
          })
        )
      )
    ).flat()
    const completed = new Set(
      runs.filter((run) => run.status === "complete").map((run) => run.hour)
    )
    const hasComparison =
      [...completed].filter(
        (hour) => hour <= oldEnd && hour > oldEnd - COMPARISON_WINDOW
      ).length >= 2
    if (!hasComparison)
      return {
        hour: snapshot.hour,
        period: input.period,
        hasComparison: false,
        rows: [],
      }
    // Read only the latest day's activity and the comparison window's day buckets.
    // Bounds are independent of the selected period; never scan 90 days per request.
    const buckets = await Promise.all(
      windows.map(([start, end]) =>
        ctx.orm.query.history.findMany({
          where: {
            league: input.league,
            day: {
              gte: Math.floor(start / DAY) * DAY,
              lte: Math.floor(end / DAY) * DAY,
            },
          },
          limit: 3500,
        })
      )
    )
    if (buckets.some((rows) => rows.length === 3500))
      throw new Error("Mover history safety bound reached")
    const byItem = new Map<string, Map<number, Point>>()
    for (const bucket of buckets.flat()) {
      const points = byItem.get(bucket.item) ?? new Map<number, Point>()
      for (const point of bucket.points) {
        if (
          completed.has(point[0]) &&
          windows.some(([start, end]) => point[0] > start && point[0] <= end)
        )
          points.set(point[0], point)
      }
      byItem.set(bucket.item, points)
    }
    const series = new Map(
      [...byItem].map(([id, points]) => [id, [...points.values()]])
    )
    return {
      hour: snapshot.hour,
      period: input.period,
      hasComparison,
      rows: moverMetrics(snapshot.prices, series, snapshot.hour, offset),
    }
  })
