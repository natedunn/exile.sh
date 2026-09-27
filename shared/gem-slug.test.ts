import { describe, expect, it } from "vitest"
import data from "../public/gems/v1/catalogue.json"
import type { GemCatalogue } from "./gems"
import { gemBySlug, gemSlug } from "./gem-slug"

const catalogue = data as GemCatalogue
const gems = Object.values(catalogue.gems).filter((gem) => gem.gameId)
const byId = (skillId: string) => gems.find((gem) => gem.skillId === skillId)!

describe("gem slugs", () => {
  it("gives every gem a unique, round-tripping slug", () => {
    const slugs = gems.map((gem) => gemSlug(catalogue, gem))
    expect(new Set(slugs).size).toBe(gems.length)
    for (const gem of gems)
      expect(gemBySlug(catalogue, gemSlug(catalogue, gem))).toBe(gem)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("reads as the gem's name", () => {
    expect(gemSlug(catalogue, byId("LightningArrowPlayer"))).toBe(
      "lightning-arrow"
    )
    expect(gemSlug(catalogue, byId("SummonSpectrePlayer"))).toBe("spectre")
  })

  it("separates clashing names predictably", () => {
    expect(gemSlug(catalogue, byId("UnleashPlayer"))).toBe("unleash")
    expect(gemSlug(catalogue, byId("SupportUnleashPlayer"))).toBe(
      "unleash-support"
    )
    expect(gemSlug(catalogue, byId("LightningBoltPlayer"))).toBe(
      "lightning-bolt"
    )
  })
})
