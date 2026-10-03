import catalog from "./catalog.json"
import { currencySlug } from "./currency-slug"
import { gemSlug } from "./gem-slug"
import type { GemCatalogue } from "./gems"
import type { ItemCatalogue } from "./item-registry"

// Only canonical public pages: no redirects, filters, authentication,
// share images, mirrored forum posts or unreviewed user-uploaded builds.
const toolPaths = [
  "/",
  "/economy/market",
  "/economy/movers",
  "/gems",
  "/items",
  "/trees/passive",
  "/trees/atlas",
  "/trees/ascendancies",
  "/trees/genesis",
  "/build-bin",
  "/patch-notes",
  "/methodology",
]

export function sitemapPaths(catalogue: GemCatalogue, items: ItemCatalogue) {
  return [
    ...new Set([
      ...toolPaths,
      ...catalog.map((item) => `/currency/${currencySlug(item.id)}`),
      ...Object.values(items.items).map((item) => `/items/${item.slug}`),
      ...Object.values(catalogue.gems)
        .filter((gem) => gem.gameId && gem.name)
        .map((gem) => `/gems/${gemSlug(catalogue, gem)}`),
    ]),
  ].sort()
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case "&":
        return "&amp;"
      case '"':
        return "&quot;"
      default:
        return "&apos;"
    }
  })
}

export function sitemapXml(origin: string, paths: string[]) {
  const base = new URL(origin).origin
  // No lastmod until we have reliable dates for significant page updates.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escapeXml(base + path)}</loc></url>`),
    "</urlset>",
  ].join("\n")
}
