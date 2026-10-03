import { createFileRoute } from "@tanstack/react-router"

// Share card for an item page. See og.gems.$gem.tsx.
export const Route = createFileRoute("/og/items/$item")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cachedCard, itemCard }, { itemCatalogue }, { itemBySlug }] =
          await Promise.all([
            import("../lib/og.server"),
            import("../lib/assets.server"),
            import("../../shared/item-registry"),
          ])
        return cachedCard(request, async () => {
          const item = itemBySlug(await itemCatalogue(), params.item)
          return item ? itemCard(item) : null
        })
      },
    },
  },
})
