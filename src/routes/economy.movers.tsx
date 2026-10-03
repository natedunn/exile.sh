import { pageShareImage } from "../lib/page-share"
import { shareMeta } from "../lib/share-meta"
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
  head: () =>
    shareMeta({
      title: "PoE2 Currency Market Movers",
      description:
        "Track rising and falling Path of Exile 2 currencies by league, with price changes and activity filters based on completed exchange trades.",
      path: "/economy/movers",
      image: pageShareImage("movers"),
    }),
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
        // Filters change in place without moving the page.
        void navigate({
          search: (prev) => ({ ...prev, page: 1, ...values }),
          resetScroll: false,
        })
      }}
    />
  )
}
