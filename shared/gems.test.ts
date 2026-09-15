import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import {
  findGem,
  findNamedGem,
  gemEffectValues,
  skillGroupLabels,
  displaySkillGroups,
} from "./gems"
import type { GemCatalogue, GemEffects } from "./gems"
import { parseBuildXml } from "./pob"

const xml = `<PathOfBuilding2><Build level="90" className="Sorceress"/><Skills><Skill><Gem nameSpec="Spark" gemId="Metadata/Items/Gems/SkillGemSpark" skillId="SparkPlayer" variantId="Spark" level="20" quality="23" corrupted="true" corruptLevel="1"/><Gem nameSpec="Elemental Armament II" gemId="Metadata/Items/Gems/SupportGemPrimalArmamentTwo" skillId="SupportElementalArmamentPlayerTwo" level="1" quality="0" enabled="false"/></Skill></Skills></PathOfBuilding2>`
test("keeps gem identity and corruption without modifying saved level or quality", () => {
  const gems = parseBuildXml(xml).skillSets[0].skills[0].gems
  expect(gems[0]).toMatchObject({
    gemId: "Metadata/Items/Gems/SkillGemSpark",
    skillId: "SparkPlayer",
    variantId: "Spark",
    corrupted: true,
    corruptLevel: "1",
    level: "20",
    quality: "23",
  })
  expect(gems[1]).toMatchObject({
    support: true,
    enabled: false,
    corrupted: false,
    quality: "0",
  })
})

function effects(skill: string): GemEffects {
  return JSON.parse(
    readFileSync(
      new URL(`../public/gems/effects-v1/${skill}.json`, import.meta.url),
      "utf8"
    )
  )
}
test("Loyalty includes both numerical effects from its pinned reference", () => {
  const gem = {
    ...parseBuildXml(xml).skillSets[0].skills[0].gems[1],
    level: "1",
  }
  const values = gemEffectValues(effects("SupportLoyaltyPlayer"), gem)
  expect(values.base?.partial).toBe(false)
  expect(values.base?.lines).toEqual(
    expect.arrayContaining([
      "Minions from Supported Skills have 30% less maximum Life",
      "10% of Damage from Hits is taken from Supported Companion's Life before you",
    ])
  )
})
test("effects select saved level, corruption and stat set, with quality separate", () => {
  const gem = parseBuildXml(xml).skillSets[0].skills[0].gems[0]
  const ref = effects("SparkPlayer")
  const values = gemEffectValues(ref, gem)
  expect(values.level).toBe(21)
  expect(values.base?.lines.join("\n")).toContain("13 to 242 Lightning Damage")
  expect(values.quality?.lines.join("\n")).toContain(
    "34% increased Projectile Speed"
  )
  expect(
    gemEffectValues(ref, { ...gem, corrupted: false }).base?.lines.join("\n")
  ).toContain("11 to 216 Lightning Damage")
  expect(gemEffectValues(ref, { ...gem, statSetIndex: "2" }).base).toEqual(
    ref.sets["2"].levels["21"]
  )
  expect(gemEffectValues(ref, { ...gem, level: "999" }).base).toBeUndefined()
  expect(
    gemEffectValues(ref, { ...gem, statSetIndex: "999" }).base
  ).toBeUndefined()
  expect(gemEffectValues(ref, { ...gem, quality: "0" }).quality).toBeUndefined()
  expect(gemEffectValues(ref, { ...gem, quality: "" }).missingQuality).toBe(
    true
  )
})
test("matches active and support art by stable IDs and handles unknown gems", () => {
  const catalogue = JSON.parse(
    readFileSync(
      new URL("../public/gems/v1/catalogue.json", import.meta.url),
      "utf8"
    )
  ) as GemCatalogue
  for (const gem of parseBuildXml(xml).skillSets[0].skills[0].gems) {
    const ref = findGem(catalogue, gem)
    expect(ref?.description.length).toBeGreaterThan(20)
    expect(ref?.image).toMatch(/^\/gems\/v1\/icons\/.+\.webp$/)
    const bytes = readFileSync(
      new URL(`../public${ref!.image}`, import.meta.url)
    )
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF")
  }
  expect(
    findGem(catalogue, {
      name: "Unknown future gem",
      support: false,
      enabled: true,
      level: "1",
      quality: "0",
    })
  ).toBeUndefined()
})

test("item skill names resolve through source-declared IDs to gem artwork", () => {
  const catalogue: GemCatalogue = JSON.parse(
    readFileSync(
      new URL("../public/gems/v1/catalogue.json", import.meta.url),
      "utf8"
    )
  )
  for (const [name, id] of [
    ["Skeletal Warrior Minion", "SummonSkeletalWarriorsPlayer"],
    ["Skeletal Sniper Minion", "SummonSkeletalSnipersPlayer"],
    ["Load Explosive Shot", "ExplosiveShotAmmoPlayer"],
  ]) {
    const ref = findNamedGem(catalogue, name)
    expect(ref?.skillId).toBe(id)
    expect(ref?.image).toMatch(/^\/gems\/v1\/icons\/.+\.webp$/)
  }
  expect(findNamedGem(catalogue, "Spark Minion")).toBeUndefined()
  expect(
    findNamedGem(catalogue, "Skeletal Warrior Minion", true)
  ).toBeUndefined()
  const warrior = findNamedGem(catalogue, "Skeletal Warrior Minion")!
  expect(
    findNamedGem(
      {
        version: "test",
        gems: {
          first: warrior,
          second: { ...warrior, variantId: "different" },
        },
      },
      "Skeletal Warrior Minion"
    )
  ).toBeUndefined()
})

test("preserves group source, removal and explicit weapon-set flags", () => {
  const build =
    parseBuildXml(`<PathOfBuilding2><Build className="Sorceress" level="90" mainSocketGroup="2"/><Skills>
    <Skill source="Item:9:Palm of the Dreamer, Shrine Sceptre" slot="Weapon 2" removed="true" set1="true" set2="false"><Gem nameSpec="Impurity" skillId="ImpurityPlayer"/></Skill>
    <Skill source="Default Attack" slot="Weapon 1 Swap" set1="nil" set2="nil"><Gem nameSpec="Punch" skillId="MeleeUnarmedPlayer"/></Skill>
    <Skill><Gem nameSpec="Impurity" skillId="ImpurityPlayer"/></Skill>
  </Skills></PathOfBuilding2>`)
  const groups = build.skillSets[0].skills
  expect(groups[0]).toMatchObject({
    source: "Item:9:Palm of the Dreamer, Shrine Sceptre",
    slot: "Weapon 2",
    removed: true,
    set1: true,
    set2: false,
  })
  expect(groups[1]).toMatchObject({ source: "Default Attack", removed: false })
  expect(groups[1].set1).toBeUndefined()
  expect(groups[1].set2).toBeUndefined()
  expect(groups[2]).toMatchObject({ source: "", removed: false })
  expect(build.mainSocketGroup).toBe(2)
  expect(groups[1].gems[0].name).toBe("Punch")
  expect(skillGroupLabels(groups[0])).toEqual([
    "Granted by Palm of the Dreamer, Shrine Sceptre",
    "Weapon set I",
  ])
  expect(skillGroupLabels(groups[1])).toEqual([
    "Default attack",
    "Weapon set II",
  ])
  expect(skillGroupLabels(groups[2])).toEqual([])
  expect(skillGroupLabels({ ...groups[2], slot: "Weapon 1" })).toEqual([])
  expect(skillGroupLabels({ ...groups[2], set1: true, set2: true })).toEqual([
    "Weapon sets I & II",
  ])
})

test("bare item grants fold into one matching setup while preserving provenance and main selection", () => {
  const build =
    parseBuildXml(`<PathOfBuilding2><Build className="Sorceress" level="90"/><Skills>
    <Skill><Gem nameSpec="Impurity" skillId="ImpurityPlayer" level="18" quality="0"/><Gem nameSpec="Vitality" skillId="SupportVitalityPlayer"/></Skill>
    <Skill source="Item:9:Sceptre" slot="Weapon 2"><Gem nameSpec="Impurity" skillId="ImpurityPlayer" level="18" quality="0"/></Skill>
  </Skills></PathOfBuilding2>`)
  const skills = build.skillSets[0].skills
  const groups = displaySkillGroups(skills, 2)
  expect(groups).toHaveLength(1)
  expect(groups[0].skill).toBe(skills[0])
  expect(groups[0].grants).toEqual([skills[1]])
  expect(groups[0].main).toBe(true)
  expect(skills).toHaveLength(2)
  // Distinct supported setups, different levels, and grants without a setup
  // must never be silently removed based on their display name.
  expect(displaySkillGroups([...skills, { ...skills[0] }], 1)).toHaveLength(3)
  expect(displaySkillGroups([skills[1]], 1)).toHaveLength(1)
  expect(
    displaySkillGroups(
      [
        skills[0],
        { ...skills[1], gems: [{ ...skills[1].gems[0], level: "19" }] },
      ],
      1
    )
  ).toHaveLength(2)
  expect(
    displaySkillGroups(
      [
        skills[0],
        {
          ...skills[1],
          gems: [{ ...skills[1].gems[0], skillId: "OtherPlayer" }],
        },
      ],
      1
    )
  ).toHaveLength(2)
  expect(
    displaySkillGroups([skills[0], { ...skills[1], gems: skills[0].gems }], 1)
  ).toHaveLength(2)
})

function itemGrantFixture() {
  return parseBuildXml(`<PathOfBuilding2><Build className="Sorceress" level="90"/><Skills>
    <Skill><Gem nameSpec="Impurity" skillId="ImpurityPlayer" variantId="Impurity" level="18" quality="0" statSetIndex="nil"/></Skill>
    <Skill source="Item:9:Sceptre" slot="Weapon 2"><Gem nameSpec="Impurity" skillId="ImpurityPlayer" variantId="Impurity" level="18" quality="0"/></Skill>
  </Skills></PathOfBuilding2>`).skillSets[0].skills
}

test.each([
  { variantId: "DifferentVariant" },
  { statSetIndex: "2" },
  { corrupted: true },
  { corruptLevel: "1" },
])("keeps item grants with different saved configuration: %j", (difference) => {
  const [setup, source] = itemGrantFixture()
  source.gems[0] = { ...source.gems[0], ...difference }
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(2)
})

test("folds equivalent absent, nil and explicit PoB defaults", () => {
  const [setup, source] = itemGrantFixture()
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(1)
  setup.gems[0].statSetIndex = undefined
  setup.gems[0].corrupted = undefined
  setup.gems[0].corruptLevel = "nil"
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(1)
})

test.each([
  ["Weapon 2", true, false, "Weapon set I"],
  ["Weapon 1 Swap", false, true, "Weapon set II"],
] as const)(
  "folds a grant in %s into its explicitly configured set",
  (slot, set1, set2, label) => {
    const [setup, source] = itemGrantFixture()
    Object.assign(setup, { set1, set2 })
    source.slot = slot
    expect(skillGroupLabels(setup)).toContain(label)
    expect(skillGroupLabels(source)).toContain(label)
    const groups = displaySkillGroups([setup, source], 2)
    expect(groups).toHaveLength(1)
    expect(groups[0].grants).toEqual([source])
    expect(groups[0].main).toBe(true)
  }
)

test("keeps conflicting or unestablished weapon availability separate", () => {
  const [setup, source] = itemGrantFixture()
  Object.assign(setup, { set1: true, set2: false })
  source.slot = "Weapon 1 Swap"
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(2)
  source.slot = ""
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(2)
  source.slot = "Weapon 2"
  Object.assign(source, { set1: false, set2: true })
  expect(skillGroupLabels(source)).toContain("Weapon set II")
  expect(displaySkillGroups([setup, source], 1)).toHaveLength(2)
})
