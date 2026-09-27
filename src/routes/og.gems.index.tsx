import { createFileRoute } from "@tanstack/react-router"

// Share card for /gems. See og.gems.$gem.tsx.
export const Route = createFileRoute("/og/gems/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ cachedCard, gemsCard }, { gemCatalogue }] = await Promise.all([
          import("../lib/og.server"),
          import("../lib/assets.server"),
        ])
        return cachedCard(request, async () => {
          const gems = Object.values((await gemCatalogue()).gems).filter(
            (gem) => gem.gameId && !gem.name.includes("{")
          )
          const supports = gems.filter((gem) => gem.support).length
          return gemsCard(gems.length - supports, supports)
        })
      },
    },
  },
})
