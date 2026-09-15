import { expect, test } from "vitest"
import { hasBondedModifiers } from "./bonded-modifiers"

test("Bonded override requires Wisdom of the Maji in a supported tree", () => {
  const spec = { title: "Shaman", version: "0_5", nodes: ["42253"] }
  expect(hasBondedModifiers(spec, "primary")).toBe(true)
  expect(hasBondedModifiers({ ...spec, version: "0_4" }, "primary")).toBe(true)
  expect(hasBondedModifiers({ ...spec, nodes: [] }, "primary")).toBe(false)
  expect(hasBondedModifiers({ ...spec, version: "0_3" }, "primary")).toBe(false)
  expect(hasBondedModifiers(undefined, "primary")).toBe(false)
})

test("Bonded override follows the selected weapon set", () => {
  const spec = {
    title: "Shaman",
    version: "0_5",
    nodes: ["42253"],
    weaponSet1: ["42253"],
    weaponSet2: [],
  }
  expect(hasBondedModifiers(spec, "primary")).toBe(true)
  expect(hasBondedModifiers(spec, "swap")).toBe(false)
  expect(hasBondedModifiers({ ...spec, weaponSet2: ["42253"] }, "swap")).toBe(
    true
  )
})
