import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import type { AugmentCatalogue } from "./augments"
import { augmentApplications, augmentTypeLabel, findAugment } from "./augments"
import modifiers from "./augment-modifiers.json"

const catalogue: AugmentCatalogue = JSON.parse(
  readFileSync("public/augments/v1/catalogue.json", "utf8")
)

test("structured references retain every existing augment effect and application", () => {
  expect(Object.keys(catalogue).sort()).toEqual(Object.keys(modifiers).sort())
  for (const [name, reference] of Object.entries(catalogue)) {
    expect(reference.applications.length).toBeGreaterThan(0)
    const lines = new Set(
      reference.applications.flatMap((application) => [
        ...application.lines,
        ...application.bonded.map((line) => `Bonded: ${line}`),
      ])
    )
    expect([...lines]).toEqual(modifiers[name as keyof typeof modifiers])
  }
})

test("soul cores retain requirements, limits and all applicable equipment", () => {
  const reference = catalogue["Xipocado's Soul Core of Dominion"]
  expect(reference).toMatchObject({ type: "SoulCore", level: 50, limit: 1 })
  expect(augmentTypeLabel(reference.type)).toBe("Soul Core")
  expect(augmentApplications(reference)).toEqual([
    {
      slots: ["Wands", "Staves", "Sceptres"],
      lines: ["Minions deal 40% increased Damage with Command Skills"],
      bonded: [],
    },
  ])
})

test("runes retain different base and Bonded effects for each equipment category", () => {
  const groups = augmentApplications(catalogue["Greater Iron Rune"])
  expect(groups).toHaveLength(3)
  expect(groups.find((group) => group.slots.includes("Armour"))).toMatchObject({
    lines: ["18% increased Armour, Evasion and Energy Shield"],
    bonded: ["+20 to maximum Life", "+20 to maximum Mana"],
  })
  expect(groups.find((group) => group.slots.includes("Wands"))?.slots).toEqual([
    "Wands",
    "Staves",
  ])
  expect(
    augmentApplications(catalogue["Saqawal's Rune of the Sky"])
  ).toHaveLength(2)
})

test("artwork spelling differences resolve without matching unknown augments", () => {
  expect(findAugment(catalogue, "Legacy of Mjölner")).toEqual(
    catalogue["Legacy of Mjolner"]
  )
  expect(findAugment(catalogue, "Unknown future rune")).toBeUndefined()
  expect(findAugment(undefined, "Greater Iron Rune")).toBeUndefined()
})

test("generic caster effects include sceptres and preserve narrower Bonded applications", () => {
  const groups = augmentApplications(catalogue["Robust Rune"])
  expect(groups).toContainEqual({
    slots: ["Wands, Staves and Sceptres"],
    lines: ["+9 to Strength"],
    bonded: [],
  })
  expect(groups).toContainEqual({
    slots: ["Wands", "Staves"],
    lines: [],
    bonded: ["+100 to Armour"],
  })
})
