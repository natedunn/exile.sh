import { stripSearchParams, createFileRoute } from "@tanstack/react-router"
import {
  EconomyPage,
  filters,
  defaultFilters,
} from "../components/economy-page"

export const Route = createFileRoute("/economy/movers")({
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  head: () => ({ meta: [{ title: "Market movers · exile.sh" }] }),
  component: Page,
})
function Page() {
  const f = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EconomyPage
      moversPage
      f={f}
      patch={(values) => {
        void navigate({ search: (prev) => ({ ...prev, page: 1, ...values }) })
      }}
    />
  )
}
