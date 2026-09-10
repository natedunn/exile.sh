import { ANCHORS, QUOTES } from "./economy"
import type { ItemPrice, Pair, Quote } from "./economy"

export const DISPLAY_CURRENCIES = ["Auto", ...QUOTES] as const

// Compare item units, not quote units: 100 Exalted and 100 Divine are not
// comparable volumes. Only completed, active pairs with a usable quote qualify.
export function autoDisplayQuotes(prices: ItemPrice[], pairs: Pair[]) {
  const available = new Set<Quote>(["Exalted"])
  for (const quote of QUOTES) {
    if (prices.some((row) => row.id === ANCHORS[quote] && row.price > 0))
      available.add(quote)
  }
  const best = new Map<string, { quote: Quote; volume: number }>()
  const consider = (item: string, counter: string, volume: number) => {
    const quote = QUOTES.find((q) => ANCHORS[q] === counter)
    if (!quote || !available.has(quote) || item === counter) return
    const previous = best.get(item)
    if (
      !previous ||
      volume > previous.volume ||
      (volume === previous.volume &&
        QUOTES.indexOf(quote) < QUOTES.indexOf(previous.quote))
    )
      best.set(item, { quote, volume })
  }
  for (const pair of pairs) {
    if (pair.va <= 0 || pair.vb <= 0) continue
    consider(pair.a, pair.b, pair.va)
    consider(pair.b, pair.a, pair.vb)
  }
  return new Map(
    prices.map((row) => [row.id, best.get(row.id)?.quote ?? "Exalted"])
  )
}
