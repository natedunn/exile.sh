import { useQuery } from "@tanstack/react-query"
import { ANCHORS, QUOTES } from "../../shared/economy"
import type { ItemRow, Quote } from "../../shared/economy"
import { autoDisplayQuotes } from "../../shared/display-currency"
import { useCRPC } from "./convex/crpc"
import type { Filters } from "./economy-filters"

/* The league's latest completed hour, priced in the reader's display
   currency. "Auto" picks each item's most natural quote. */
export function useMarket(f: Pick<Filters, "league" | "quote">) {
  const crpc = useCRPC()
  const query = useQuery(
    crpc.economy.overview.queryOptions({ league: f.league })
  )
  const rows = query.data?.prices ?? []
  const autoQuotes = autoDisplayQuotes(rows, query.data?.pairs ?? [])
  const displayQuote = (id: string): Quote =>
    f.quote === "Auto" ? (autoQuotes.get(id) ?? "Exalted") : f.quote
  const quoteIndex = (id: string) => QUOTES.indexOf(displayQuote(id))
  const rate = (id: string) =>
    displayQuote(id) === "Exalted"
      ? 1
      : rows.find((row) => row.id === ANCHORS[displayQuote(id)])?.price
  /** The row's price in its display currency, or null without an anchor. */
  const value = (row: ItemRow) => {
    const conversion = rate(row.id)
    return conversion ? row.price / conversion : null
  }
  return { query, rows, displayQuote, quoteIndex, value }
}
