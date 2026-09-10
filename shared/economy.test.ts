import { describe, expect, test } from "vitest"
import {
  ANCHORS,
  DAY,
  HOUR,
  change,
  eligibleMover,
  exchangeSchema,
  mergePoint,
  pairRate,
  priceMarkets,
  quotePoints,
  retryDelay,
  weightedPrice,
} from "./economy"
import type { Market, Point } from "./economy"

const ex = ANCHORS.Exalted,
  chaos = ANCHORS.Chaos
function market(a: string, b: string, va: number, vb: number): Market {
  const amounts = { [a]: va, [b]: vb }
  return {
    league: "Standard",
    market_id: `${a}|${b}`,
    market_pair: [a, b],
    volume_traded: amounts,
    lowest_stock: amounts,
    highest_stock: amounts,
    lowest_ratio: amounts,
    highest_ratio: amounts,
  }
}
describe("executed prices", () => {
  test("rates invert and ignore pair storage order", () => {
    const m = market("item", ex, 10, 250)
    expect(pairRate(m, "item", ex)).toBe(25)
    expect(pairRate(m, ex, "item")).toBe(0.04)
    expect(pairRate(market(ex, "item", 250, 10), "item", ex)).toBe(25)
    expect(pairRate(market("item", ex, 0, 20), "item", ex)).toBeNull()
  })
  test("direct observation beats a larger bridge and retains its own volume", () => {
    const rows = priceMarkets([
      market(chaos, ex, 100, 1000),
      market("item", chaos, 1000, 9000),
      market("item", ex, 5, 20),
    ])
    expect(rows.find((r) => r.id === "item")).toEqual({
      id: "item",
      price: 4,
      volume: 5,
      direct: true,
    })
  })
  test("bridge needs a same-hour anchor; zero-sided trades do not manufacture a price", () => {
    expect(
      priceMarkets([market("item", chaos, 2, 8)]).find((r) => r.id === "item")
    ).toBeUndefined()
    expect(
      priceMarkets([
        market(chaos, ex, 100, 1000),
        market("item", chaos, 2, 8),
      ]).find((r) => r.id === "item")
    ).toEqual({ id: "item", price: 40, volume: 2, direct: false })
  })
  test("schema rejects missing sides, nonintegers, and malformed identities", () => {
    const m = market("item", ex, 1, 4)
    expect(
      exchangeSchema.safeParse({
        next_change_id: HOUR,
        markets: [{ ...m, market_id: "wrong" }],
      }).success
    ).toBe(false)
    expect(
      exchangeSchema.safeParse({
        next_change_id: HOUR,
        markets: [{ ...m, volume_traded: { item: 0.5 } }],
      }).success
    ).toBe(false)
  })
})
describe("history and movers", () => {
  test("replaying an hour replaces rather than double-counting volume", () => {
    const point: Point = [HOUR, 5, 10, 1]
    expect(mergePoint(mergePoint([], point), point)).toEqual([point])
    expect(mergePoint([point], [HOUR, 6, 11, 1])).toEqual([[HOUR, 6, 11, 1]])
  })
  test("weighted means use traded item units, not a mean of hourly rates", () => {
    expect(
      weightedPrice([
        [0, 10, 1, 1],
        [HOUR, 20, 9, 1],
      ])
    ).toBe(19)
    expect(weightedPrice([])).toBeNull()
  })
  test("missing historical quote observations create gaps", () => {
    expect(
      quotePoints(
        [
          [0, 10, 1, 1],
          [HOUR, 20, 1, 1],
        ],
        [[0, 2, 1, 1]],
        "Chaos"
      )
    ).toEqual([[0, 5, 1, 1]])
  })
  test("change requires windows; movers additionally need activity and liquidity", () => {
    const points: Point[] = Array.from({ length: 28 }, (_, i) => [
      i * HOUR,
      i >= 25 ? 20 : 10,
      100,
      1,
    ])
    expect(change(points, 27 * HOUR, DAY)).toBe(100)
    expect(eligibleMover(points, 27 * HOUR)).toBe(true)
    expect(
      eligibleMover(
        points.map((p) => [p[0], p[1], 1, p[3]]),
        27 * HOUR
      )
    ).toBe(false)
    expect(change(points.slice(-24), 27 * HOUR, DAY)).toBeNull()
    expect(eligibleMover(points.slice(0, -1), 27 * HOUR)).toBe(false)
  })
})
test("all rate rules and Retry-After constrain the next request", () => {
  const headers = new Headers({
    "Retry-After": "10",
    "X-Rate-Limit-Rules": "ip, client",
    "X-Rate-Limit-ip": "10:60:60",
    "X-Rate-Limit-ip-State": "9:60:0",
    "X-Rate-Limit-client": "30:120:300",
    "X-Rate-Limit-client-State": "2:120:300",
  })
  expect(retryDelay(headers, 429)).toBe(300000)
  expect(retryDelay(new Headers(), 500, 3)).toBe(40000)
})
