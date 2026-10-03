import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { currencyBySlug } from "../../shared/currency-slug"
import { CurrencyPage } from "../components/economy/currency-page"
import { items, plainDescription } from "../lib/catalog"
import { defaultFilters, filters } from "../lib/economy-filters"
import { shareMeta } from "../lib/share-meta"
import { useMarket } from "../lib/use-market"

/* One page per currency, reached from the market, the movers, and every
   exchange pair. The list filters ride along so the way back restores them. */
export const Route = createFileRoute("/currency/$slug")({
  validateSearch: (search) => filters.parse(search),
  search: {
    middlewares: [stripSearchParams<typeof defaultFilters>(defaultFilters)],
  },
  // The catalogue ships with the app, so share tags need no server lookup.
  head: ({ params }) => {
    const id = currencyBySlug(params.slug)
    const item = id ? items.get(id) : undefined
    if (!item) return { meta: [{ title: "Currency · exile.sh" }] }
    const description = plainDescription(item.description).trim()
    return shareMeta({
      title: `${item.name} Price & Exchange Rates — PoE2`,
      description: `${item.name} price history, exchange rates and markets in Path of Exile 2.${description ? ` ${description}` : ""}`,
      path: `/currency/${params.slug}`,
      image: `/og/currency/${params.slug}`,
    })
  },
  component: CurrencyRoute,
})

function CurrencyRoute() {
  const { slug } = Route.useParams()
  const f = Route.useSearch()
  const navigate = Route.useNavigate()
  // Ids the catalogue lacks still resolve once the market lists them.
  const { rows } = useMarket(f)
  const id = currencyBySlug(
    slug,
    rows.map((row) => row.id)
  )
  return (
    <CurrencyPage
      id={id}
      f={f}
      patch={(values) =>
        void navigate({
          search: (prev) => ({ ...prev, ...values }),
          resetScroll: false,
        })
      }
    />
  )
}
