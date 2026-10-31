import { readDataFileSync as readFileSync } from "./data-test-files"
import { describe, expect, it } from "vitest"
import type {
  BaseReference,
  ItemCatalogue,
  UniqueReference,
} from "./item-registry"
import { uniqueModifiers } from "./item-registry"
import { uniqueStatRows } from "./unique-stats"

const catalogue = JSON.parse(
  readFileSync(
    new URL("../public/items/v1/catalogue.json", import.meta.url),
    "utf8"
  )
) as ItemCatalogue

const rowsOf = (slug: string, baseSlug?: string) => {
  const unique = catalogue.items[slug] as UniqueReference
  const base = catalogue.items[
    baseSlug ?? (unique.baseSlug as string)
  ] as BaseReference
  const texts = uniqueModifiers(unique, unique.variants[0]?.id ?? 0).map(
    (mod) => mod.text
  )
  return uniqueStatRows(base, texts)
}

describe("unique stats", () => {
  it("adds flat defence before increases, rounding once", () => {
    // Silk Robe 64 ES with +(100-150) to maximum Energy Shield.
    expect(rowsOf("unique-temporalis-silk-robe")).toContainEqual({
      label: "Energy shield",
      value: "164–214",
    })
    // 89 armour at (200-250)% increased: 267 and 311.5, rounded to 312.
    const ab = rowsOf("unique-ab-aeterno-grand-cuisses")
    expect(ab).toContainEqual({ label: "Armour", value: "267–312" })
    expect(ab).toContainEqual({ label: "Energy shield", value: "75–88" })
  })

  it("applies local weapon modifiers", () => {
    const lioneye = Object.values(catalogue.items).find(
      (item) => item.name === "Lioneye's Glare"
    ) as UniqueReference
    const rows = rowsOf(lioneye.slug)
    expect(rows).toContainEqual({
      label: "Physical damage",
      value: "(113–153) to (188–255)",
    })
    expect(rows).toContainEqual({ label: "Attacks per second", value: "1.32" })
  })

  it("leaves modifiers on jewellery to the character", () => {
    const amulet = catalogue.items[
      "unique-astramentis-stellar-amulet"
    ] as UniqueReference
    const base = catalogue.items[amulet.baseSlug as string] as BaseReference
    expect(
      uniqueStatRows(base, [
        "+100 to maximum Energy Shield",
        "50% increased Armour",
      ])
    ).toEqual(uniqueStatRows(base, []))
  })

  it("keeps the unique's modifiers on another form of its base", () => {
    const rows = rowsOf(
      "unique-ab-aeterno-grand-cuisses",
      "base-runemastered-grand-cuisses"
    )
    expect(rows.find((row) => row.label === "Armour")?.value).not.toBe("89")
    expect(rows.some((row) => row.label === "Runic Ward")).toBe(true)
  })
})
