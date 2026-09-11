import { existsSync, readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { describeEquipment } from "./equipment"
import { parseBuild } from "./pob"
import art from "./equipment-art.json"

const item = (rarity: string, body: string) => ({
  id: "1",
  name: body.split("\n")[0],
  rarity,
  text: `Rarity: ${rarity}\n${body}`,
})
test("rare gear resolves its base artwork instead of its generated name", () => {
  const result = describeEquipment(
    item(
      "RARE",
      "Beast Cry\nSanctified Staff\nQuality: 20\nLevelReq: 84\nSockets: S S\n150% increased Spell Damage"
    )
  )
  expect(result.base).toBe("Sanctified Staff")
  expect(result.artwork?.image).toBe(art.bases["Sanctified Staff"].image)
  expect(result.properties).toEqual(["Quality: 20"])
  expect(result.requirements).toEqual(["Level 84"])
  expect(result.socketCount).toBe(2)
})
test("uniques resolve their distinct artwork and magic bases tolerate affixes", () => {
  const unique = describeEquipment(
    item("UNIQUE", "Astramentis\nStellar Amulet\n+100 to all Attributes")
  )
  expect(unique.artwork?.image).toBe(art.uniques.Astramentis.image)
  expect(unique.artwork?.image).not.toBe(art.bases["Stellar Amulet"].image)
  expect(
    describeEquipment(
      item("MAGIC", "Glowing Gold Ring of the Fox\n+10 to Dexterity")
    ).base
  ).toBe("Gold Ring")
})
test("unknown equipment remains inspectable and variant markers are not silently removed", () => {
  const result = describeEquipment(
    item(
      "RARE",
      "Future Item\nUnknown New Base\nUnique ID: hidden\n{crafted}+20 to maximum Life\n{variant:2}30% increased Damage\nCorrupted"
    )
  )
  expect(result.artwork).toBeUndefined()
  expect(result.modifiers).toContainEqual({
    kind: "crafted",
    text: "+20 to maximum Life",
  })
  expect(result.modifiers).toContainEqual({
    kind: "normal",
    text: "{variant:2}30% increased Damage",
  })
  expect(result.variantWarning).toBe(true)
  expect(result.modifiers.some((m) => m.text.includes("hidden"))).toBe(false)
})
test("real exported equipment resolves to locally mirrored images", () => {
  const build = parseBuild(
    readFileSync(
      new URL("./fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
      "utf8"
    )
  )
  const equipped = new Set(
    build.itemSets.flatMap((s) => s.slots.map((slot) => slot.itemId))
  )
  for (const saved of build.items.filter((i) => equipped.has(i.id))) {
    const details = describeEquipment(saved)
    expect(details.artwork?.image, saved.name).toMatch(
      /^\/equipment\/.+\.webp$/
    )
  }
  for (const table of [art.bases, art.uniques])
    for (const row of Object.values(table)) {
      expect(
        existsSync(new URL(`../public${row.image}`, import.meta.url)),
        row.image
      ).toBe(true)
    }
})

test("socket artwork preserves order, duplicates, and empty or unknown sockets", () => {
  const details = describeEquipment(
    item(
      "RARE",
      "Beast Cry\nSanctified Staff\nSockets: S S S S\nRune: Iron Rune\nRune: None\nSoul Core: Future Core\nRune: Iron Rune"
    )
  )
  expect(details.socketContents.map((s) => s.name)).toEqual([
    "Iron Rune",
    "Empty socket",
    "Future Core",
    "Iron Rune",
  ])
  expect(details.socketContents[0].image).toMatch(
    /^\/equipment\/sockets\/.+\.webp$/
  )
  expect(details.socketContents[1].image).toBeUndefined()
  expect(details.socketContents[2].image).toBeUndefined()
  expect(details.socketContents[3].image).toBe(details.socketContents[0].image)
  expect(
    existsSync(
      new URL(`../public${details.socketContents[0].image}`, import.meta.url)
    )
  ).toBe(true)
  const unspecified = describeEquipment(
    item("RARE", "Beast Cry\nSanctified Staff\nSockets: S")
  )
  expect(unspecified.socketContents).toEqual([
    { name: "Unspecified socket", image: undefined },
  ])
})

test("Grand Spectrum artwork follows its Ruby, Emerald, or Sapphire base", () => {
  const images = ["Ruby", "Emerald", "Sapphire"].map(
    (base) =>
      describeEquipment(item("UNIQUE", "Grand Spectrum\n" + base)).artwork
        ?.image
  )
  expect(images.every(Boolean)).toBe(true)
  expect(new Set(images).size).toBe(3)
})
