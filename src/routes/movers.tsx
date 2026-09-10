import { createFileRoute } from "@tanstack/react-router"
import { EconomyPage, filters } from "../components/economy-page"

export const Route = createFileRoute("/movers")({
  validateSearch: (search) => filters.parse(search),
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
