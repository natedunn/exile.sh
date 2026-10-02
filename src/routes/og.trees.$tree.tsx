import { createFileRoute } from "@tanstack/react-router"

// Share card for a tree page. See og.gems.$gem.tsx.
export const Route = createFileRoute("/og/trees/$tree")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cachedCard, treeCard }, { isTreeShare }] = await Promise.all([
          import("../lib/og.server"),
          import("../lib/tree-share"),
        ])
        return cachedCard(request, async () =>
          isTreeShare(params.tree) ? treeCard(params.tree) : null
        )
      },
    },
  },
})
