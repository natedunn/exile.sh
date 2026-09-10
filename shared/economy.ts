import { z } from "zod"

export const HOUR = 3600
export const DAY = 24 * HOUR
export const QUOTES = ["Exalted", "Chaos", "Divine"] as const
export type Quote = (typeof QUOTES)[number]
export const ANCHORS: Record<Quote, string> = {
  Exalted: "Metadata/Items/Currency/CurrencyAddModToRare",
  Chaos: "Metadata/Items/Currency/CurrencyRerollRare",
  Divine: "Metadata/Items/Currency/CurrencyModValues",
}
export const LEAGUES = [
  "Forbidden Rites",
  "HC Forbidden Rites",
  "Standard",
  "Hardcore",
] as const
export const DEFAULT_LEAGUE = LEAGUES[0]
export const METHOD = "executed-volume-v1"
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const quantities = z.record(z.string(), amount)
export const marketSchema = z
  .object({
    league: z.string().min(1),
    market_id: z.string().min(1),
    market_pair: z.tuple([z.string(), z.string()]),
    volume_traded: quantities,
    lowest_stock: quantities,
    highest_stock: quantities,
    lowest_ratio: quantities,
    highest_ratio: quantities,
  })
  .superRefine((m, ctx) => {
    if (
      m.market_pair[0] === m.market_pair[1] ||
      m.market_id !== m.market_pair.join("|")
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid market identity" })
    }
    for (const field of [
      "volume_traded",
      "lowest_stock",
      "highest_stock",
      "lowest_ratio",
      "highest_ratio",
    ] as const) {
      for (const id of m.market_pair)
        if (!Object.hasOwn(m[field], id))
          ctx.addIssue({ code: "custom", message: `Missing ${field} side` })
    }
  })
export const exchangeSchema = z.object({
  next_change_id: amount,
  markets: z.array(marketSchema).max(30_000),
})
export type Market = z.infer<typeof marketSchema>
export type ItemPrice = {
  id: string
  price: number
  volume: number
  direct: boolean
}
export type ItemRow = ItemPrice & {
  changes: (number | null)[]
  changes7: (number | null)[]
  eligible: boolean[]
  trends: (number | null)[][]
}
// [UTC hour, Exalted per item, traded item units, direct-to-Exalted flag]
export type Point = [number, number, number, number]
export type CatalogItem = {
  id: string
  name: string
  category: string
  icon: string
  description: string
}
export type Pair = {
  id: string
  a: string
  b: string
  va: number
  vb: number
  sa: number
  sb: number
}

export function pairRate(
  m: Market,
  item: string,
  quote: string
): number | null {
  if (
    !m.market_pair.includes(item) ||
    !m.market_pair.includes(quote) ||
    item === quote
  )
    return null
  const a = m.volume_traded[item],
    b = m.volume_traded[quote]
  return a > 0 && b > 0 ? b / a : null
}

export function priceMarkets(markets: Market[]): ItemPrice[] {
  const base = ANCHORS.Exalted
  const direct = new Map<string, ItemPrice>([
    [base, { id: base, price: 1, volume: 0, direct: true }],
  ])
  const volume = new Map<string, number>()
  for (const m of markets) {
    for (const id of m.market_pair)
      volume.set(id, (volume.get(id) ?? 0) + m.volume_traded[id])
    if (!m.market_pair.includes(base)) continue
    const id = m.market_pair.find((i) => i !== base)!
    const rate = pairRate(m, id, base)
    if (rate !== null)
      direct.set(id, {
        id,
        price: rate,
        volume: m.volume_traded[id],
        direct: true,
      })
  }
  const candidates = new Map<string, { value: number; volume: number }>()
  for (const m of markets)
    for (const anchor of [ANCHORS.Chaos, ANCHORS.Divine]) {
      if (!m.market_pair.includes(anchor)) continue
      const id = m.market_pair.find((i) => i !== anchor)!
      if (direct.has(id)) continue
      const bridge = direct.get(anchor),
        rate = pairRate(m, id, anchor)
      if (!bridge || rate === null) continue
      const units = m.volume_traded[id]
      const prior = candidates.get(id)
      // Prefer the highest-volume one-bridge observation; never use a different hour.
      if (!prior || prior.volume < units)
        candidates.set(id, { value: rate * bridge.price, volume: units })
    }
  for (const [id, c] of candidates)
    direct.set(id, { id, price: c.value, volume: c.volume, direct: false })
  // Keep the weight tied to the price observation, not all unrelated pair trades.
  const basePrice = direct.get(base)!
  basePrice.volume = volume.get(base) ?? 0
  return [...direct.values()].filter(
    (p) =>
      Number.isFinite(p.price) && p.price > 0 && Number.isSafeInteger(p.volume)
  )
}

export function mergePoint(points: Point[], point: Point): Point[] {
  return [...points.filter((p) => p[0] !== point[0]), point].sort(
    (a, b) => a[0] - b[0]
  )
}
export function weightedPrice(points: Point[]): number | null {
  const volume = points.reduce((s, p) => s + p[2], 0)
  return volume > 0
    ? points.reduce((s, p) => s + p[1] * p[2], 0) / volume
    : null
}
export function change(
  points: Point[],
  at: number,
  offset: number
): number | null {
  const window = (end: number) =>
    points.filter((p) => p[0] <= end && p[0] > end - 3 * HOUR)
  const current = window(at),
    previous = window(at - offset)
  if (current.length < 2 || previous.length < 2) return null
  const a = weightedPrice(current),
    b = weightedPrice(previous)
  return a !== null && b !== null && b > 0 ? (a / b - 1) * 100 : null
}
export function eligibleMover(points: Point[], at: number): boolean {
  const recent = points.filter((p) => p[0] > at - DAY && p[0] <= at)
  const old = points.filter(
    (p) => p[0] <= at - DAY && p[0] > at - DAY - 3 * HOUR
  )
  const current = recent.filter((p) => p[0] > at - 3 * HOUR)
  const notional = (ps: Point[]) => ps.reduce((s, p) => s + p[1] * p[2], 0)
  return (
    recent.length >= 12 &&
    current.length >= 2 &&
    old.length >= 2 &&
    recent.some((p) => p[0] === at) &&
    notional(current) >= 1000 &&
    notional(old) >= 1000
  )
}
export function quotePoints(
  points: Point[],
  rates: Point[],
  quote: Quote
): Point[] {
  if (quote === "Exalted") return points
  const byHour = new Map(rates.map((p) => [p[0], p[1]]))
  return points.flatMap((p) => {
    const rate = byHour.get(p[0])
    return rate && rate > 0 ? [[p[0], p[1] / rate, p[2], p[3]] as Point] : []
  })
}
export function toPairs(markets: Market[]): Pair[] {
  return markets.map((m) => ({
    id: m.market_id,
    a: m.market_pair[0],
    b: m.market_pair[1],
    va: m.volume_traded[m.market_pair[0]],
    vb: m.volume_traded[m.market_pair[1]],
    sa: m.highest_stock[m.market_pair[0]],
    sb: m.highest_stock[m.market_pair[1]],
  }))
}

export function retryDelay(
  headers: Headers,
  status: number,
  failures = 0
): number {
  let delay =
    status === 429 ? 60_000 : Math.min(3_600_000, 5000 * 2 ** failures)
  const retry = headers.get("retry-after")
  if (retry) {
    const seconds = Number(retry)
    const ms = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retry) - Date.now()
    if (Number.isFinite(ms)) delay = Math.max(delay, ms)
  }
  for (const rule of (headers.get("x-rate-limit-rules") ?? "").split(",")) {
    const limits = (headers.get(`x-rate-limit-${rule.trim()}`) ?? "").split(",")
    const states = (
      headers.get(`x-rate-limit-${rule.trim()}-state`) ?? ""
    ).split(",")
    limits.forEach((limit, i) => {
      const [max, period] = limit.split(":").map(Number)
      const [count, , restricted] = (states[i] ?? "").split(":").map(Number)
      if (restricted > 0) delay = Math.max(delay, restricted * 1000)
      if (max > 0 && count >= max - 1) delay = Math.max(delay, period * 1000)
    })
  }
  return delay
}

export const pointSchema = z.tuple([
  z.number(),
  z.number().positive(),
  z.number().nonnegative(),
  z.number(),
])
export const itemRowSchema = z.object({
  id: z.string(),
  price: z.number().positive(),
  volume: z.number().nonnegative(),
  direct: z.boolean(),
  changes: z.array(z.number().nullable()).length(3),
  changes7: z.array(z.number().nullable()).length(3),
  eligible: z.array(z.boolean()).length(3),
  trends: z.array(z.array(z.number().nullable()).length(8)).length(3),
})
export const pairSchema = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
  va: z.number().nonnegative(),
  vb: z.number().nonnegative(),
  sa: z.number().nonnegative(),
  sb: z.number().nonnegative(),
})
