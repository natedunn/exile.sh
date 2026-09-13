import { z } from "zod"
import { DEFAULT_LEAGUE, LEAGUES } from "../../shared/economy"
import { DISPLAY_CURRENCIES } from "../../shared/display-currency"
import { MOVER_PERIODS } from "../../shared/movers"

/* Price-history ranges, keyed the way mover periods are. */
export const CHART_RANGES = ["24h", "7d", "30d", "90d"] as const
export type ChartRange = (typeof CHART_RANGES)[number]
export const CHART_RANGE_DAYS: Record<ChartRange, 1 | 7 | 30 | 90> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

export const filters = z.object({
  league: z.enum(LEAGUES).catch(DEFAULT_LEAGUE),
  quote: z.enum(DISPLAY_CURRENCIES).catch("Auto"),
  category: z.string().catch("All currencies"),
  q: z.string().max(120).catch(""),
  sort: z.enum(["price", "name", "change", "volume"]).catch("price"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  favorites: z.boolean().catch(false),
  period: z.enum(MOVER_PERIODS).catch("24h"),
  item: z.string().max(240).catch(""),
  range: z.enum(CHART_RANGES).catch("7d"),
})
export const defaultFilters = filters.parse({})
export type Filters = z.infer<typeof filters>
