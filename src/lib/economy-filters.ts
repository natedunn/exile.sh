import { z } from "zod"
import { DEFAULT_LEAGUE, LEAGUES } from "../../shared/economy"
import { DISPLAY_CURRENCIES } from "../../shared/display-currency"
import { MOVER_PERIODS } from "../../shared/movers"

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
})
export const defaultFilters = filters.parse({})
export type Filters = z.infer<typeof filters>
