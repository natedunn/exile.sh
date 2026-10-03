import { pageShareImage } from "../lib/page-share"
import { shareMeta } from "../lib/share-meta"
import { stripSearchParams, createFileRoute } from "@tanstack/react-router"
import {
  EconomyPage,
  filters,
  defaultFilters,
} from "../components/economy-page"

export const Route = createFileRoute("/economy/market")({
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  head: () =>
    shareMeta({
      title: "PoE2 Currency Prices & Exchange Rates",
      description:
        "Explore Path of Exile 2 currency prices, historical exchange rates and traded volume by league. Prices come from completed GGG exchange trades.",
      path: "/economy/market",
      image: pageShareImage("market"),
    }),
  component: Page,
})
function Page() {
  const f = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EconomyPage
      f={f}
      patch={(values) => {
        // Filters change in place without moving the page.
        void navigate({
          search: (prev) => ({ ...prev, page: 1, ...values }),
          resetScroll: false,
        })
      }}
    />
  )
}
