"use node"

import { createHash, randomUUID } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import { z } from "zod"
import { privateAction } from "../lib/crpc"
import { createStoreCaller } from "./generated/store.runtime"
import { createIngestionCaller } from "./generated/ingestion.runtime"
import {
  DAY,
  HOUR,
  LEAGUES,
  exchangeSchema,
  priceMarkets,
  retryDelay,
  toPairs,
} from "../../shared/economy"
import type { Id } from "./_generated/dataModel"

async function boundedBody(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Missing response body")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 12 * 1024 * 1024)
        throw new Error("Feed exceeded 12 MiB safety bound")
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
  }
  return Buffer.concat(chunks)
}

export const ingest = privateAction
  .input(
    z.object({
      hour: z.number().int().optional(),
      remaining: z.number().int().min(1).max(48).optional(),
    })
  )
  .action(async ({ ctx, input }) => {
    if (input.hour === undefined && process.env.COLLECTOR_ENABLED !== "true")
      return { status: "paused" }
    const store = createStoreCaller(ctx)
    const state = await store.state()
    const latestComplete = Math.floor(Date.now() / 1000 / HOUR) * HOUR - HOUR
    const hour =
      input.hour ?? Math.min(state?.cursor ?? latestComplete, latestComplete)
    if (
      hour % HOUR !== 0 ||
      hour > latestComplete ||
      hour < latestComplete - 8 * DAY
    )
      throw new Error("Hour outside bounded retention window")
    const token = randomUUID()
    if (!(await store.acquire({ hour, token }))) {
      // Administrative backfill resumes after a lease or rate-limit pause.
      if (input.hour !== undefined && (state?.failures ?? 0) < 5)
        await createIngestionCaller(ctx)
          .schedule.after(
            Math.max(
              5000,
              (state?.nextAllowedAt ?? 0) - Date.now(),
              (state?.leaseUntil ?? 0) - Date.now()
            )
          )
          .ingest(input)
      return { status: "busy" }
    }
    let next = hour
    let delay = 5000
    try {
      const previous = await store.imported({ hour })
      if (previous?.status !== "complete") {
        let raw: Uint8Array
        let archive = previous?.archive
        if (archive) {
          const blob = await ctx.storage.get(archive as Id<"_storage">)
          if (!blob)
            throw new Error("Archive missing; review import before retry")
          raw = gunzipSync(Buffer.from(await blob.arrayBuffer()))
        } else {
          const response = await fetch(
            `https://web.poecdn.com/api/currency-exchange/poe2/${hour}`,
            {
              headers: {
                "User-Agent": `exile.sh/0.1.0 (contact: ${process.env.GGG_CONTACT ?? "hello@natedunn.net"})`,
              },
              signal: AbortSignal.timeout(30_000),
            }
          )
          delay = retryDelay(
            response.headers,
            response.status,
            state?.failures ?? 0
          )
          if (response.status !== 200)
            throw new Error(`GGG HTTP ${response.status}`)
          raw = await boundedBody(response)
        }
        const feed = exchangeSchema.parse(
          JSON.parse(Buffer.from(raw).toString("utf8"))
        )
        if (feed.next_change_id === hour) {
          await store.release({
            token,
            cursor: hour,
            error: "",
            nextAllowedAt: (latestComplete + 2 * HOUR) * 1000,
          })
          return { status: "caught-up" }
        }
        if (feed.next_change_id !== hour + HOUR)
          throw new Error(
            "Unexpected cursor progression; manual review required"
          )
        const keys = new Set<string>()
        for (const m of feed.markets) {
          const key = `${m.league}:${m.market_id}`
          if (keys.has(key)) throw new Error("Duplicate market in source hour")
          keys.add(key)
        }
        const leagues = LEAGUES.map((league) => {
          const markets = feed.markets.filter((m) => m.league === league)
          return {
            league,
            prices: priceMarkets(markets),
            pairs: toPairs(markets),
          }
        })
        const chunks = leagues.flatMap((l) =>
          Array.from({ length: Math.ceil(l.prices.length / 80) }, (_, i) => ({
            league: l.league,
            prices: l.prices.slice(i * 80, (i + 1) * 80),
          }))
        )
        if (!archive)
          archive = await ctx.storage.store(
            new Blob([new Uint8Array(gzipSync(raw))], {
              type: "application/gzip",
            })
          )
        await store.begin({
          hour,
          archive,
          hash: createHash("sha256").update(raw).digest("hex"),
          bytes: raw.byteLength,
          marketCount: feed.markets.length,
          expectedChunks: chunks.length,
        })
        for (const [chunk, batch] of chunks.entries())
          await store.writeChunk({ hour, chunk, ...batch })
        await store.publish({ hour, leagues })
      }
      next = hour + HOUR
      await store.release({
        token,
        cursor: next,
        nextAllowedAt: Date.now() + delay,
        error: "",
      })
      if ((input.remaining ?? 1) > 1 && next <= latestComplete) {
        await createIngestionCaller(ctx)
          .schedule.after(delay)
          .ingest({ hour: next, remaining: (input.remaining ?? 1) - 1 })
      }
      return { status: "complete", hour }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Unknown ingestion error"
      await store.release({
        token,
        cursor: next,
        nextAllowedAt: Date.now() + delay,
        error: message,
      })
      if ((state?.failures ?? 0) < 4)
        await createIngestionCaller(ctx)
          .schedule.after(delay)
          .ingest({ ...input, hour })
      console.error(
        JSON.stringify({ event: "ingestion-failed", hour, message })
      )
      return { status: "error", hour, message }
    }
  })
