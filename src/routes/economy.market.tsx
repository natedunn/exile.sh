import { createFileRoute } from "@tanstack/react-router"
import { EconomyPage, filters } from "../components/economy-page"

export const Route = createFileRoute("/economy/market")({
  validateSearch: (search) => filters.parse(search),
  head: () => ({ meta: [{ title: "Exchange economy · exile.sh" }] }),
  component: Page,
})
function Page() {
  const f = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EconomyPage
      f={f}
      patch={(values) => {
        void navigate({ search: (prev) => ({ ...prev, page: 1, ...values }) })
      }}
    />
  )
}
