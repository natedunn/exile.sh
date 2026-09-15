import { existsSync, readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { describeEquipment, equipmentJewelSlots } from "./equipment"
import { parseBuild } from "./pob"
import art from "./equipment-art.json"

const item = (rarity: string, body: string) => ({
  id: "1",
  name: body.split("\n")[0],
  rarity,
  text: `Rarity: ${rarity}\n${body}`,
})
test("jewel slots are classified separately from extra equipment", () => {
  const items = [
    { ...item("RARE", "Blue Jewel\nSapphire\n+10 to Intelligence"), id: "1" },
    { ...item("RARE", "Future Jewel\nUnknown Base"), id: "2" },
    { ...item("RARE", "Saved Jewel\nUnknown Base"), id: "3" },
    { ...item("RARE", "Extra Ring\nGold Ring"), id: "4" },
  ]
  const gear = {
    id: "1",
    title: "Test",
    slots: [
      { name: "Other", itemId: "1" },
      { name: "Gloves Jewel Socket 1", itemId: "2" },
      { name: "Tree socket", itemId: "3" },
      { name: "Extra ring", itemId: "4" },
      { name: "Helmet Jewel Socket 1", itemId: "0" },
    ],
  }
  expect(
    equipmentJewelSlots(
      {
        items,
        treeSpecs: [
          {
            title: "Test tree",
            version: "0.5",
            nodes: [],
            sockets: [{ nodeId: "11184", itemId: "3" }],
          },
        ],
      },
      gear
    ).map((slot) => slot.itemId)
  ).toEqual(["1", "2", "3"])
})
test("anointment enchantments are distinct from corruption enchantments", () => {
  const details = describeEquipment(
    item(
      "RARE",
      "Example\nStellar Amulet\nImplicits: 2\n{enchant}Allocates Beef\n{enchant}+82 to Accuracy Rating\nCorrupted"
    )
  )
  expect(details.implicitModifiers).toEqual([
    { text: "Allocates Beef", kind: "enchant" },
    { text: "+82 to Accuracy Rating", kind: "corrupted" },
  ])
})
test("implicit counts include enchantments and exclude status lines", () => {
  const result = describeEquipment(
    item(
      "UNIQUE",
      [
        "Example",
        "Stellar Amulet",
        "Implicits: 2",
        "{enchant}{rune}+1 to Level of all Spell Skills",
        "--------",
        "+10 to all Attributes",
        "{mutated}+30 to maximum Life",
        "Corrupted",
      ].join("\n")
    )
  )
  expect(result.implicitModifiers.map((line) => line.text)).toEqual([
    "+1 to Level of all Spell Skills",
    "+10 to all Attributes",
  ])
  expect(result.explicitModifiers).toEqual([
    { text: "+30 to maximum Life", kind: "mutated" },
  ])
  expect(result.statuses.map((line) => line.text)).toEqual(["Corrupted"])
})

test("explicit implicit tags work without a count and retain variant markers", () => {
  const result = describeEquipment(
    item(
      "UNIQUE",
      [
        "Example",
        "Stellar Amulet",
        "{variant:2}{implicit}+10 to all Attributes",
        "{crafted}+20 to maximum Life",
      ].join("\n")
    )
  )
  expect(result.implicitModifiers).toEqual([
    { text: "{variant:2}+10 to all Attributes", kind: "normal" },
  ])
  expect(result.explicitModifiers).toEqual([
    { text: "+20 to maximum Life", kind: "crafted" },
  ])
  expect(result.variantWarning).toBe(true)
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

test.each(["Corrupted", "Twice Corrupted"])(
  "%s is a status, not an affix",
  (status) => {
    const details = describeEquipment(
      item(
        "RARE",
        `Example\nStellar Amulet\nImplicits: 2\n{enchant}+82 to Accuracy Rating\n{enchant}+12% to Chaos Resistance\n${status}`
      )
    )
    expect(details.statuses.map((line) => line.text)).toEqual([status])
    expect(details.implicitModifiers).toHaveLength(2)
    expect(details.explicitModifiers).toHaveLength(0)
  }
)

test("a modifier wrapped over two export lines reads as one line", () => {
  const details = describeEquipment({
    id: "wrapped",
    name: "Eldritch Battery Jewel",
    rarity: "RARE",
    text: [
      "Rarity: RARE",
      "Eldritch Battery Jewel",
      "Diamond",
      "Passives in Radius of Eldritch Battery can be Allocated",
      "without being connected to your tree",
    ].join("\n"),
  })
  expect(details.modifiers.map((line) => line.text)).toEqual([
    "Passives in Radius of Eldritch Battery can be Allocated without being connected to your tree",
  ])
})
