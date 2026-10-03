import { describe, expect, it } from "vitest"
import { XMLValidator, XMLParser } from "fast-xml-parser"
import gems from "../public/gems/v1/catalogue.json"
import items from "../public/items/v1/catalogue.json"
import catalog from "./catalog.json"
import { currencyBySlug } from "./currency-slug"
import { gemBySlug } from "./gem-slug"
import type { GemCatalogue } from "./gems"
import { itemBySlug } from "./item-registry"
import type { ItemCatalogue } from "./item-registry"
import { sitemapPaths, sitemapXml } from "./sitemap"

const catalogue = gems as GemCatalogue
const itemCatalogue = items as ItemCatalogue

describe("public sitemap", () => {
  it("lists every routable catalogue entry without duplicates or private URLs", () => {
    const paths = sitemapPaths(catalogue, itemCatalogue)
    const currencyPaths = paths.filter((path) => path.startsWith("/currency/"))
    const gemPaths = paths.filter((path) => path.startsWith("/gems/"))
    const itemPaths = paths.filter((path) => path.startsWith("/items/"))
    expect(itemPaths).toHaveLength(Object.keys(itemCatalogue.items).length)
    for (const path of itemPaths)
      expect(
        itemBySlug(itemCatalogue, path.slice("/items/".length))
      ).toBeDefined()
    expect(currencyPaths).toHaveLength(catalog.length)
    expect(gemPaths).toHaveLength(
      Object.values(catalogue.gems).filter((gem) => gem.gameId && gem.name)
        .length
    )
    for (const path of currencyPaths)
      expect(currencyBySlug(path.slice("/currency/".length))).toBeDefined()
    for (const path of gemPaths)
      expect(gemBySlug(catalogue, path.slice("/gems/".length))).toBeDefined()
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths.length).toBeLessThan(50_000)
    expect(paths).toContain("/economy/market")
    expect(paths).toContain("/trees/passive")
    expect(paths).toContain("/trees/genesis")
    expect(paths).toContain("/items")
    expect(paths).toContain("/build-bin")
    expect(paths).toContain("/")
    expect(paths).not.toContain("/about")
    expect(paths).not.toContain("/home-preview")
    expect(paths).not.toContain("/auth")
    expect(paths).not.toContain("/create-account")
    for (const path of paths) expect(path).not.toMatch(/[?#]/)
  })

  it("produces valid XML with absolute URLs and escaped entities", () => {
    const xml = sitemapXml("https://exile.sh/", ["/gems", "/example?a=1&b=2"])
    expect(XMLValidator.validate(xml)).toBe(true)
    const parsed = new XMLParser().parse(xml)
    expect(
      parsed.urlset.url.map((entry: { loc: string }) => entry.loc)
    ).toEqual(["https://exile.sh/gems", "https://exile.sh/example?a=1&b=2"])
    expect(xml).toContain("&amp;")
    expect(xml).not.toContain("lastmod")
  })
})
