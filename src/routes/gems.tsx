import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from "@tanstack/react-router"
import { z } from "zod"

export const gemSearch = z.object({
  q: z.string().catch(""),
  level: z.coerce.number().int().min(1).max(40).catch(1),
  quality: z.coerce.number().int().min(0).max(62).catch(0),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
})

export const defaultGemSearch = gemSearch.parse({})
export type GemSearch = z.infer<typeof gemSearch>

export const Route = createFileRoute("/gems")({
  validateSearch: (search) => gemSearch.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultGemSearch>(defaultGemSearch)],
  },
  component: Outlet,
})
