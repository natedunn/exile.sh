import { eq } from "kitcn/orm"
import { z } from "zod"
import { privateMutation, privateQuery } from "../lib/crpc"
import { collector, history, imports, snapshots, pairSnapshots } from "./schema"
import {
  ANCHORS,
  DAY,
  HOUR,
  METHOD,
  QUOTES,
  change,
  eligibleMover,
  mergePoint,
  quotePoints,
  weightedPrice,
} from "../../shared/economy"
import type { Id } from "./_generated/dataModel"
import type { ItemRow, Point } from "../../shared/economy"

const price = z.object({
  id: z.string(),
  price: z.number().positive(),
  volume: z.number().nonnegative(),
  direct: z.boolean(),
})
const pair = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  va: z.number(),
  vb: z.number(),
  sa: z.number(),
  sb: z.number(),
})
export const acquire = privateMutation
  .input(z.object({ hour: z.number().int(), token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.collector.findFirst({
      where: { key: "poe2" },
    })
    const now = Date.now()
    if (
      row &&
      (row.leaseUntil > now || row.nextAllowedAt > now || row.failures >= 5)
    )
      return false
    const values = {
      key: "poe2",
      leaseUntil: now + 10 * 60_000,
      leaseToken: input.token,
      nextAllowedAt: row?.nextAllowedAt ?? 0,
      failures: row?.failures ?? 0,
      lastError: "",
      cursor: row?.cursor ?? input.hour,
    }
    if (row)
      await ctx.orm
        .update(collector)
        .set(values)
        .where(eq(collector.id, row.id))
    else await ctx.orm.insert(collector).values(values)
    return true
  })
export const state = privateQuery.query(
  async ({ ctx }) =>
    await ctx.orm.query.collector.findFirst({ where: { key: "poe2" } })
)
export const release = privateMutation
  .input(
    z.object({
      token: z.string(),
      cursor: z.number(),
      nextAllowedAt: z.number(),
      error: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.collector.findFirst({
      where: { key: "poe2" },
    })
    if (!row || row.leaseToken !== input.token) return
    await ctx.orm
      .update(collector)
      .set({
        leaseUntil: 0,
        cursor: Math.max(row.cursor, input.cursor),
        nextAllowedAt: input.nextAllowedAt,
        failures: input.error ? row.failures + 1 : 0,
        lastError: input.error,
      })
      .where(eq(collector.id, row.id))
  })
export const resetCircuit = privateMutation.mutation(async ({ ctx }) => {
  const row = await ctx.orm.query.collector.findFirst({
    where: { key: "poe2" },
  })
  if (row && row.leaseUntil < Date.now())
    await ctx.orm
      .update(collector)
      .set({ failures: 0, nextAllowedAt: 0 })
      .where(eq(collector.id, row.id))
})
export const imported = privateQuery
  .input(z.object({ hour: z.number() }))
  .query(
    async ({ ctx, input }) =>
      await ctx.orm.query.imports.findFirst({ where: { hour: input.hour } })
  )
export const begin = privateMutation
  .input(
    z.object({
      hour: z.number(),
      hash: z.string(),
      archive: z.string(),
      marketCount: z.number(),
      bytes: z.number(),
      expectedChunks: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.imports.findFirst({
      where: { hour: input.hour },
    })
    if (existing) {
      if (existing.hash !== input.hash)
        throw new Error("Archived hour changed; manual review required")
      return
    }
    await ctx.orm
      .insert(imports)
      .values({ ...input, status: "processing", completedChunks: [] })
  })
export const writeChunk = privateMutation
  .input(
    z.object({
      hour: z.number(),
      chunk: z.number(),
      league: z.string(),
      prices: z.array(price).max(80),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const run = await ctx.orm.query.imports.findFirst({
      where: { hour: input.hour },
    })
    if (
      !run ||
      run.status === "complete" ||
      run.completedChunks.includes(input.chunk)
    )
      return
    if (
      !Number.isInteger(input.chunk) ||
      input.chunk < 0 ||
      input.chunk >= run.expectedChunks
    )
      throw new Error("Invalid chunk sequence")
    const day = Math.floor(input.hour / DAY) * DAY
    for (const p of input.prices) {
      const row = await ctx.orm.query.history.findFirst({
        where: { league: input.league, item: p.id, day },
      })
      const point: Point = [input.hour, p.price, p.volume, p.direct ? 1 : 0]
      if (row)
        await ctx.orm
          .update(history)
          .set({ points: mergePoint(row.points, point) })
          .where(eq(history.id, row.id))
      else
        await ctx.orm
          .insert(history)
          .values({ league: input.league, item: p.id, day, points: [point] })
    }
    await ctx.orm
      .update(imports)
      .set({ completedChunks: [...run.completedChunks, input.chunk] })
      .where(eq(imports.id, run.id))
  })
export const recent = privateQuery
  .input(z.object({ league: z.string(), hour: z.number() }))
  .query(async ({ ctx, input }) => {
    return await ctx.orm.query.history.findMany({
      where: {
        league: input.league,
        day: { gte: Math.floor((input.hour - 8 * DAY) / DAY) * DAY },
      },
      limit: 8000,
    })
  })
export const publish = privateMutation
  .input(
    z.object({
      hour: z.number(),
      leagues: z.array(
        z.object({
          league: z.string(),
          prices: z.array(price),
          pairs: z.array(pair),
        })
      ),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const run = await ctx.orm.query.imports.findFirst({
      where: { hour: input.hour },
    })
    if (!run || run.status === "complete") return
    if (run.completedChunks.length !== run.expectedChunks)
      throw new Error("Incomplete hour cannot be published")
    for (const league of input.leagues) {
      const latest = await ctx.orm.query.snapshots.findFirst({
        where: { league: league.league },
        orderBy: { hour: "desc" },
      })
      if (latest && latest.hour > input.hour) continue
      const records = await ctx.orm.query.history.findMany({
        where: {
          league: league.league,
          day: { gte: Math.floor((input.hour - 8 * DAY) / DAY) * DAY },
        },
        limit: 8000,
      })
      if (records.length === 8000)
        throw new Error(
          "History safety bound reached; partition publication before continuing"
        )
      const byItem = new Map<string, Point[]>()
      for (const r of records)
        byItem.set(r.item, [
          ...(byItem.get(r.item) ?? []),
          ...r.points.filter((p) => p[0] <= input.hour),
        ])
      const rows: ItemRow[] = league.prices.map((p) => {
        const series = QUOTES.map((quote) =>
          quotePoints(
            byItem.get(p.id) ?? [],
            byItem.get(ANCHORS[quote]) ?? [],
            quote
          )
        )
        return {
          ...p,
          changes: series.map((ps) => change(ps, input.hour, DAY)),
          changes7: series.map((ps) => change(ps, input.hour, 7 * DAY)),
          eligible: series.map(
            (ps, i) =>
              p.id !== ANCHORS[QUOTES[i]] &&
              change(ps, input.hour, DAY) !== null &&
              eligibleMover(byItem.get(p.id) ?? [], input.hour)
          ),
          trends: series.map((ps) =>
            Array.from({ length: 8 }, (_, i) => {
              const end = input.hour - (7 - i) * 6 * HOUR
              return weightedPrice(
                ps.filter((v) => v[0] <= end && v[0] > end - 6 * HOUR)
              )
            })
          ),
        }
      })
      const priorPairs = await ctx.orm.query.pairSnapshots.findMany({
        where: { league: league.league },
        limit: 100,
      })
      for (const row of priorPairs)
        await ctx.orm.delete(pairSnapshots).where(eq(pairSnapshots.id, row.id))
      for (let i = 0; i < league.pairs.length; i += 250)
        await ctx.orm.insert(pairSnapshots).values({
          league: league.league,
          hour: input.hour,
          chunk: i / 250,
          pairs: league.pairs.slice(i, i + 250),
        })
      const data = {
        league: league.league,
        hour: input.hour,
        prices: rows,
        pairs: [],
        method: METHOD,
      }
      // One current snapshot per league, atomically published with the completion ledger.
      if (latest)
        await ctx.orm
          .update(snapshots)
          .set(data)
          .where(eq(snapshots.id, latest.id))
      else await ctx.orm.insert(snapshots).values(data)
    }
    await ctx.orm
      .update(imports)
      .set({ status: "complete" })
      .where(eq(imports.id, run.id))
  })

// Small hourly batches bound retention work, even after a long pause.
export const cleanup = privateMutation.mutation(async ({ ctx }) => {
  const cutoff = Math.floor(Date.now() / 1000 / DAY) * DAY - 8 * DAY
  const oldHistory = await ctx.orm.query.history.findMany({
    where: { day: { lt: cutoff } },
    limit: 200,
  })
  for (const row of oldHistory)
    await ctx.orm.delete(history).where(eq(history.id, row.id))
  const oldImports = await ctx.orm.query.imports.findMany({
    where: { hour: { lt: cutoff } },
    limit: 24,
  })
  for (const row of oldImports) {
    await ctx.storage.delete(row.archive as Id<"_storage">)
    await ctx.orm.delete(imports).where(eq(imports.id, row.id))
  }
  return {
    historyDeleted: oldHistory.length,
    archivesDeleted: oldImports.length,
  }
})
