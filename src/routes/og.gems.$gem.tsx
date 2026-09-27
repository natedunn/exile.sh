import { createFileRoute } from "@tanstack/react-router"

// Share card for a gem page. The renderer loads lazily so its WASM and
// Worker-only imports stay on the server.
export const Route = createFileRoute("/og/gems/$gem")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [
          { cachedCard, gemCard },
          { gemCatalogue },
          { gemBySlug, gemSlug },
        ] = await Promise.all([
          import("../lib/og.server"),
          import("../lib/assets.server"),
          import("../../shared/gem-slug"),
        ])
        return cachedCard(request, async () => {
          const catalogue = await gemCatalogue()
          const gem = gemBySlug(catalogue, params.gem)
          return gem ? gemCard(gem, gemSlug(catalogue, gem)) : null
        })
      },
    },
  },
})
