import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from "@tanstack/react-router"
import { z } from "zod"

export const itemSearch = z.object({
  q: z.string().catch(""),
  kind: z.enum(["all", "unique", "base"]).catch("unique"),
  itemClass: z.string().catch(""),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
})
const defaults = itemSearch.parse({})
export type ItemSearch = z.infer<typeof itemSearch>
export const Route = createFileRoute("/items")({
  validateSearch: (search) => itemSearch.parse(search),
  search: { middlewares: [stripSearchParams<typeof defaults>(defaults)] },
  component: Outlet,
})
