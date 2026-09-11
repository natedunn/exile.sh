import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { findGem, gemEffectValues } from "./gems"
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
