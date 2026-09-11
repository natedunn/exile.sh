import {
  stripSearchParams,
  createFileRoute,
  redirect,
} from "@tanstack/react-router"
import { filters, defaultFilters } from "../components/economy-page"

export const Route = createFileRoute("/movers")({
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/economy/movers", search, replace: true })
  },
})
