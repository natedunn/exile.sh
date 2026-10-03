import { createFileRoute } from "@tanstack/react-router"

// Share card for a page without art of its own. See og.gems.$gem.tsx.
export const Route = createFileRoute("/og/pages/$page")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ cachedCard, pageCard }, { isPageShare }] = await Promise.all([
          import("../lib/og.server"),
          import("../lib/page-share"),
        ])
        return cachedCard(request, async () =>
          isPageShare(params.page) ? pageCard(params.page) : null
        )
      },
    },
  },
})
