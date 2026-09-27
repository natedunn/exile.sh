import { createFileRoute } from "@tanstack/react-router"

// Share card for a currency page. See og.gems.$gem.tsx.
export const Route = createFileRoute("/og/currency/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cachedCard, currencyCard }, { currencyBySlug }, { items }] =
          await Promise.all([
            import("../lib/og.server"),
            import("../../shared/currency-slug"),
            import("../lib/catalog"),
          ])
        return cachedCard(request, async () => {
          const id = currencyBySlug(params.slug)
          const item = id ? items.get(id) : undefined
          return item ? currencyCard(item, params.slug) : null
        })
      },
    },
  },
})
