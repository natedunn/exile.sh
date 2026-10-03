import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [
          { gemCatalogue, itemCatalogue },
          { sitemapPaths, sitemapXml },
          { siteUrl },
        ] = await Promise.all([
          import("../lib/assets.server"),
          import("../../shared/sitemap"),
          import("../lib/share-meta"),
        ])
        const [gems, items] = await Promise.all([
          gemCatalogue(),
          itemCatalogue(),
        ])
        const paths = sitemapPaths(gems, items)
        return new Response(sitemapXml(siteUrl, paths), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=300",
          },
        })
      },
    },
  },
})
