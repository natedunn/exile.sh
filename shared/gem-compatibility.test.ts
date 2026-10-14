import { readDataJson } from "./data-test-files"
import type snapshotType1 from "../public/gems/v1/catalogue.json"
import type snapshotType2 from "../public/gems/v1/support-compatibility.json"
import { describe, expect, it } from "vitest"

import type { GemCatalogue } from "./gems"
import { gemBySlug } from "./gem-slug"
import { compatibleGems } from "./gem-compatibility"

const catalogueData = readDataJson<typeof snapshotType1>(
  "../public/gems/v1/catalogue.json"
)
const compatibility = readDataJson<typeof snapshotType2>(
  "../public/gems/v1/support-compatibility.json"
)

const catalogue = catalogueData as GemCatalogue

describe("server-rendered compatible gem links", () => {
  it("keeps skill/support links reciprocal and canonical across colliding names", () => {
    const support = gemBySlug(catalogue, "loyalty")!
    const skills = compatibleGems(support, catalogue, compatibility)!
    expect(skills.some(({ slug }) => slug === "wolf-pack")).toBe(true)
    for (const { reference, slug } of skills) {
      expect(gemBySlug(catalogue, slug)).toBe(reference)
      expect(
        compatibleGems(reference, catalogue, compatibility)
      ).toContainEqual({
        reference: support,
        slug: "loyalty",
      })
    }
    const skill = gemBySlug(catalogue, "lightning-arrow")!
    const supports = compatibleGems(skill, catalogue, compatibility)!
    expect(supports.length).toBeGreaterThan(0)
    for (const { reference, slug } of supports) {
      expect(reference.support).toBe(true)
      expect(gemBySlug(catalogue, slug)).toBe(reference)
    }
  })

  it("distinguishes missing compatibility from a known empty result", () => {
    const support = gemBySlug(catalogue, "loyalty")!
    expect(
      compatibleGems(support, catalogue, { ...compatibility, supports: {} })
    ).toBeNull()
    expect(
      compatibleGems(support, catalogue, {
        ...compatibility,
        supports: { [support.skillId]: [] },
      })
    ).toEqual([])
  })
})
