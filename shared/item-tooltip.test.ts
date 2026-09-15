import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { parseBuild } from "./pob"
import { describeEquipment } from "./equipment"
import { grantedSkillName, groupItemAugments } from "./item-tooltip"

const build = parseBuild(
  readFileSync(
    new URL("./fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
    "utf8"
  )
)

test("augment effects match their source even when exported in a different order", () => {
  const details = describeEquipment(build.items[0])
  const { groups, unmatched } = groupItemAugments(details)
  expect(unmatched).toEqual([])
  expect(groups[0].augments[0].name).toBe("Saqawal's Rune of the Sky")
  expect(groups[0].lines.map((line) => line.text)).toContain(
    "Gain 5% of Damage as Extra Damage of all Elements"
  )
  expect(groups[1].lines.map((line) => line.text)).toEqual([
    "+1 to Level of all Spell Skills",
    "Bonded: Archon recovery period expires 30% faster",
  ])
  expect(groups.flatMap((group) => group.lines)).toHaveLength(
    details.augmentModifiers.length
  )
})

test("duplicate augments retain one combined exported value", () => {
  const { groups, unmatched } = groupItemAugments(
    describeEquipment(build.items[1])
  )
  expect(unmatched).toEqual([])
  expect(groups).toHaveLength(1)
  expect(groups[0].augments[0]).toMatchObject({
    name: "Greater Iron Rune",
    count: 2,
  })
  expect(groups[0].lines[0].text).toBe("36% increased Physical Damage")
})

test("unknown augment effects remain visible without guessing a source", () => {
  const details = describeEquipment({
    ...build.items[0],
    text: build.items[0].text.replace(
      "Gain 5% of Damage as Extra Damage of all Elements",
      "Future unknown effect"
    ),
  })
  expect(groupItemAugments(details).unmatched.map((line) => line.text)).toEqual(
    ["Future unknown effect"]
  )
})

test("only zero quality is omitted", () => {
  for (const quality of ["0", "+0%", "20", "-1"]) {
    const details = describeEquipment({
      ...build.items[0],
      text: build.items[0].text.replace("Quality: 20", `Quality: ${quality}`),
    })
    expect(details.properties.some((line) => line.startsWith("Quality:"))).toBe(
      Number.parseFloat(quality) !== 0
    )
  }
})

test("granted skill names support saved levels and unresolved PoB ranges", () => {
  expect(grantedSkillName("Grants Skill: Level 19 Consecrate")).toBe(
    "Consecrate"
  )
  expect(
    grantedSkillName("{range:0.5}Grants Skill: Level (1-20) Sigil of Power")
  ).toBe("Sigil of Power")
  expect(grantedSkillName("+1 to Level of all Spell Skills")).toBeUndefined()
})
