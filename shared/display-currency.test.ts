import { describe, expect, test } from "vitest"
import { autoDisplayQuotes } from "./display-currency"
import { ANCHORS } from "./economy"
import type { ItemPrice, Pair } from "./economy"

const item = "test-item"
const prices: ItemPrice[] = [
  { id: item, price: 50, volume: 1, direct: true },
  { id: ANCHORS.Exalted, price: 1, volume: 1, direct: true },
  { id: ANCHORS.Chaos, price: 20, volume: 1, direct: true },
  { id: ANCHORS.Divine, price: 200, volume: 1, direct: true },
]
const pair = (a: string, b: string, va: number, vb: number): Pair => ({
  id: `${a}|${b}`,
  a,
  b,
  va,
  vb,
  sa: 0,
  sb: 0,
})
describe("automatic display currencies", () => {
  test("compares item units across quote markets, independent of pair orientation", () => {
    const quotes = autoDisplayQuotes(prices, [
      pair(item, ANCHORS.Exalted, 10, 500),
      pair(ANCHORS.Divine, item, 5, 20),
    ])
    expect(quotes.get(item)).toBe("Divine")
    expect(quotes.get(ANCHORS.Divine)).toBe("Exalted")
  })
  test("each item chooses its own busiest quote and never quotes itself", () => {
    const quotes = autoDisplayQuotes(prices, [
      pair(item, ANCHORS.Divine, 30, 10),
      pair(ANCHORS.Exalted, ANCHORS.Chaos, 100, 5),
    ])
    expect(quotes.get(item)).toBe("Divine")
    expect(quotes.get(ANCHORS.Exalted)).toBe("Chaos")
    expect(quotes.get(ANCHORS.Chaos)).toBe("Exalted")
  })
  test("ignores inactive pairs and missing conversion prices", () => {
    const quotes = autoDisplayQuotes(
      prices.filter((r) => r.id !== ANCHORS.Divine),
      [
        pair(item, ANCHORS.Divine, 100, 50),
        pair(item, ANCHORS.Chaos, 80, 0),
        pair(item, ANCHORS.Exalted, 5, 1),
      ]
    )
    expect(quotes.get(item)).toBe("Exalted")
  })
  test("resolves ties deterministically and falls back to Exalted without activity", () => {
    const pairs = [
      pair(item, ANCHORS.Chaos, 10, 1),
      pair(item, ANCHORS.Exalted, 10, 100),
    ]
    expect(autoDisplayQuotes(prices, pairs).get(item)).toBe("Exalted")
    expect(autoDisplayQuotes(prices, pairs.reverse()).get(item)).toBe("Exalted")
    expect(autoDisplayQuotes(prices, []).get(item)).toBe("Exalted")
    expect(autoDisplayQuotes([], []).size).toBe(0)
  })
})
