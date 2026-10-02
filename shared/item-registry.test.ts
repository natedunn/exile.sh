import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import type {
  BaseReference,
  ItemCatalogue,
  ModifierCatalogue,
  UniqueReference,
} from "./item-registry"
import {
  itemBySlug,
  baseStatRows,
  modifierMatchesBase,
  augmentOutcomes,
  baseInfluences,
  essenceOutcomes,
  modifierFamilies,
  modifierInfluence,
  searchItems,
  uniqueModifiers,
  uniqueBaseForms,
  relatedBases,
} from "./item-registry"

const catalogue = JSON.parse(
  readFileSync(
    new URL("../public/items/v1/catalogue.json", import.meta.url),
    "utf8"
  )
) as ItemCatalogue
const modifiers = JSON.parse(
  readFileSync(
    new URL("../public/items/v1/modifiers.json", import.meta.url),
    "utf8"
  )
) as ModifierCatalogue
const astramentis = catalogue.items[
  "unique-astramentis-stellar-amulet"
] as UniqueReference
const amulet = catalogue.items["base-stellar-amulet"] as BaseReference
const firstBase = (itemClass: string, tag?: string) =>
  Object.values(catalogue.items).find(
    (item): item is BaseReference =>
      item.kind === "base" &&
      item.form === "original" &&
      item.itemClass === itemClass &&
      (!tag || item.tags.includes(tag))
  )!

describe("item registry", () => {
  it("rejects missing slugs and prototype keys", () => {
    expect(itemBySlug(catalogue, "missing")).toBeUndefined()
    expect(itemBySlug(catalogue, "__proto__")).toBeUndefined()
    expect(itemBySlug(catalogue, "toString")).toBeUndefined()
  })
  it("searches modifier text with type filters and handles blank queries", () => {
    expect(
      searchItems(catalogue, "all attributes", "unique", "Amulet").some(
        (item) => item.slug === astramentis.slug
      )
    ).toBe(true)
    expect(
      searchItems(catalogue, "Stellar", "base", "").map((item) => item.slug)
    ).toContain(amulet.slug)
    expect(searchItems(catalogue, "thisdoesnotexist", "all", "")).toEqual([])
    expect(
      searchItems(catalogue, "  ", "base", "Ring").every(
        (item) => item.kind === "base" && item.itemClass === "Ring"
      )
    ).toBe(true)
  })

  it("uses current unique variants even when the URL asks for legacy or invalid IDs", () => {
    for (const id of [0, 1, 2, 999]) {
      const lines = uniqueModifiers(astramentis, id).map((mod) => mod.text)
      expect(lines).toContain("+(50-100) to all Attributes")
      expect(lines).not.toContain("+(80-100) to all Attributes")
    }
  })

  it("preserves exclusion order and never substitutes mod tags for item tags", () => {
    const strength = modifiers.mods.Strength1
    expect(modifierMatchesBase(strength, amulet)).toBe(true)
    expect(
      modifierMatchesBase(
        {
          ...strength,
          eligibility: [
            { tag: "amulet", allowed: false },
            { tag: "default", allowed: true },
          ],
        },
        amulet
      )
    ).toBe(false)
    expect(modifierMatchesBase({ ...strength, domain: "flask" }, amulet)).toBe(
      false
    )
    expect(
      modifierMatchesBase(
        { ...strength, eligibility: [{ tag: "nonexistent", allowed: true }] },
        amulet
      )
    ).toBe(false)
  })

  it("labels desecrated eligibility as a separate source domain", () => {
    const desecrated = Object.values(modifiers.mods).find(
      (mod) => mod.source === "desecrated" && modifierMatchesBase(mod, amulet)
    )
    expect(desecrated).toBeDefined()
    expect(desecrated?.domain).toBe("desecrated")
  })

  it("groups modifier tiers into families, best tier first", () => {
    const life = modifierFamilies(
      Object.values(modifiers.mods).filter(
        (mod) => mod.source === "normal" && modifierMatchesBase(mod, amulet)
      )
    ).find((family) => family.tiers.some((mod) => mod.id === "IncreasedLife1"))
    expect(life).toBeDefined()
    const levels = life!.tiers.map((mod) => mod.level)
    expect(levels).toEqual([...levels].sort((a, b) => b - a))
    expect(new Set(life!.tiers.map((mod) => mod.affix)).size).toBe(1)
  })

  it("unlocks influence pools only with their added tag", () => {
    const robe = Object.values(catalogue.items).find(
      (item): item is BaseReference =>
        item.kind === "base" &&
        item.itemClass === "Body Armour" &&
        item.tags.includes("int_armour")
    )!
    const soul = Object.values(modifiers.mods).filter(
      (mod) => modifierInfluence(mod, modifiers.influences)?.tag === "soul"
    )
    expect(soul.some((mod) => modifierMatchesBase(mod, robe))).toBe(false)
    const unlocked = soul.filter((mod) =>
      modifierMatchesBase(mod, robe, ["soul"])
    )
    expect(unlocked.filter((mod) => mod.affix === "prefix")).toHaveLength(6)
    expect(unlocked.filter((mod) => mod.affix === "suffix")).toHaveLength(5)
    // Hybrid defences follow the base's own armour type.
    expect(
      unlocked.some(
        (mod) => mod.id === "SoulInfluenceSpiritDefencesHybridArmour"
      )
    ).toBe(false)
  })

  it("resolves essence outcomes and affixes by item class", () => {
    const outcomes = essenceOutcomes(modifiers, firstBase("Body Armour"))
    expect(
      outcomes.find(
        (outcome) => outcome.essence === "Lesser Essence of the Body"
      )
    ).toMatchObject({ affix: "prefix" })
    expect(
      outcomes.every((outcome) => ["prefix", "suffix"].includes(outcome.affix))
    ).toBe(true)
    expect(essenceOutcomes(modifiers, firstBase("Jewel"))).toEqual([])
  })

  // Cross-checked against poe2db's per-class modifier data on 2026-10-02.
  it("offers each influence only on its warp rune's item class", () => {
    const pools = (itemClass: string, tag?: string) =>
      baseInfluences(modifiers, firstBase(itemClass, tag)).map(
        (influence) => influence.tag
      )
    expect(pools("Talisman")).toEqual(["destruction"])
    expect(pools("Body Armour", "int_armour")).toEqual(["soul"])
    expect(pools("Helmet")).toEqual(["berserking"])
    expect(pools("Gloves")).toEqual(["decay", "marksman"])
    expect(pools("Boots")).toEqual(["chronomancy"])
    expect(pools("Wand")).toEqual(["destruction"])
    for (const itemClass of ["Quiver", "Focus", "Ring", "Amulet", "Belt"])
      expect(pools(itemClass)).toEqual([])
  })

  it("resolves one-of essences to the outcome the base can roll", () => {
    const enhancement = (tag: string) =>
      essenceOutcomes(modifiers, firstBase("Body Armour", tag))
        .filter((row) => row.essence === "Lesser Essence of Enhancement")
        .map((row) => row.text)
    expect(enhancement("int_armour")).toEqual([
      "(27-42)% increased Energy Shield",
    ])
    expect(enhancement("str_armour")).toEqual(["(27-42)% increased Armour"])
    const infinite = essenceOutcomes(modifiers, firstBase("Amulet")).filter(
      (row) => row.essence === "Perfect Essence of the Infinite"
    )
    expect(infinite.map((row) => row.text).sort()).toEqual([
      "(7-10)% increased Dexterity",
      "(7-10)% increased Intelligence",
      "(7-10)% increased Strength",
    ])
  })

  it("includes charm, Orb of Sacrifice and caster-weapon augment data", () => {
    const charm = firstBase("Charm")
    expect(
      Object.values(modifiers.mods).some(
        (mod) =>
          /^Recover .* Life when used$/i.test(mod.text) &&
          modifierMatchesBase(mod, charm)
      )
    ).toBe(true)
    expect(
      Object.values(modifiers.mods).some(
        (mod) =>
          mod.source === "sacrifice" &&
          modifierMatchesBase(mod, firstBase("Body Armour", "int_armour"))
      )
    ).toBe(true)
    expect(
      augmentOutcomes(modifiers, "Sceptre").map((augment) => augment.name)
    ).toContain("Rune of Renown")
  })

  it("writes every roll range low to high", () => {
    const backwards = /\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)/g
    for (const mod of Object.values(modifiers.mods))
      for (const [, low, high] of mod.text.matchAll(backwards))
        expect(Number(low), mod.id).toBeLessThanOrEqual(Number(high))
  })

  it("combines augment effects named directly and through slot families", () => {
    const helmet = augmentOutcomes(modifiers, "Helmet")
    expect(helmet.length).toBeGreaterThan(0)
    expect(helmet.some((augment) => augment.type === "Soul Core")).toBe(true)
    expect(
      helmet.every((augment) => augment.text.length + augment.bonded.length > 0)
    ).toBe(true)
    expect(augmentOutcomes(modifiers, "Ring")).toEqual([])
  })

  it("ships complete identities, resolvable base links, and no legacy-only modifiers", () => {
    expect(Object.keys(catalogue.items).length).toBeGreaterThan(1000)
    for (const [slug, item] of Object.entries(catalogue.items)) {
      expect(item.slug).toBe(slug)
      expect(item.name).not.toBe("")
      if (item.kind === "unique") {
        if (item.name !== "Tabula Rasa")
          expect(item.modifiers.length, item.name).toBeGreaterThan(0)
        else expect(item.metadata).toContain("Sockets: J J J J J J")
        expect(item.variants.length).toBeGreaterThan(0)
        expect(
          item.variants.every(
            (variant) => !/\bPre \d|^\d+\.\d/.test(variant.name)
          )
        ).toBe(true)
        if (item.baseSlug)
          expect(catalogue.items[item.baseSlug].kind).toBe("base")
        for (const mod of item.modifiers) {
          expect(mod.text).not.toMatch(/\{(?:variant|version|tags|group):/)
          expect(
            mod.variants.every((id) =>
              item.variants.some((variant) => variant.id === id)
            )
          ).toBe(true)
        }
      }
    }
  })

  it("converts native weapon and flask units into readable base stats", () => {
    const bow = catalogue.items["base-crude-bow"] as BaseReference
    expect(baseStatRows(bow)).toContainEqual({
      label: "Attacks per second",
      value: "1.20",
    })
    expect(baseStatRows(bow)).toContainEqual({
      label: "Critical hit chance",
      value: "5%",
    })
    const flask = catalogue.items["base-lesser-life-flask"] as BaseReference
    expect(baseStatRows(flask)).toContainEqual({
      label: "Duration",
      value: "3s",
    })
  })

  it("retains granted skills and charm slots from base definitions", () => {
    const wand = catalogue.items["base-withered-wand"] as BaseReference
    const belt = catalogue.items["base-wide-belt"] as BaseReference
    expect(wand.implicits.join()).toContain("Chaos Bolt")
    expect(belt.implicits.join()).toContain("Charm Slot")
    expect(amulet.requirements.level).toBe(24)
  })
  it("imports Ward and preserves distinct same-name forged bases", () => {
    const fullPlate = catalogue.items[
      "base-runemastered-full-plate"
    ] as BaseReference
    expect(baseStatRows(fullPlate)).toContainEqual({
      label: "Runic Ward",
      value: "126",
    })
    expect(fullPlate.requirements.strength).toBe(72)
    const forks = searchItems(
      catalogue,
      "Runemastered Runic Fork",
      "base",
      "Wand"
    ) as BaseReference[]
    expect(forks).toHaveLength(3)
    expect(new Set(forks.map((base) => base.implicits.join())).size).toBe(3)
    expect(
      forks.some((base) =>
        base.implicits.includes("+300 to maximum Runic Ward")
      )
    ).toBe(true)
    const mails = searchItems(
      catalogue,
      "Runeforged Grasping Mail",
      "base",
      "Body Armour"
    ).filter(
      (item) => item.name === "Runeforged Grasping Mail"
    ) as BaseReference[]
    expect(mails).toHaveLength(4)
    expect(
      new Set(mails.map((base) => JSON.stringify(base.requirements))).size
    ).toBe(4)
    expect(
      mails.find((base) => base.id.endsWith("Verisium4"))?.properties.ward
    ).toEqual({ min: 215, max: 215 })
    expect(relatedBases(catalogue, fullPlate).map((base) => base.form)).toEqual(
      ["original", "runeforged", "runemastered"]
    )
  })

  it("offers unique forms only through recorded connected recipes", () => {
    const necromantle = catalogue.items[
      "unique-necromantle-bone-raiment"
    ] as UniqueReference
    expect(
      uniqueBaseForms(catalogue, necromantle).map((base) => base.form)
    ).toEqual(["original", "runemastered"])
    expect(
      uniqueBaseForms(catalogue, astramentis).map((base) => base.form)
    ).toEqual(["original"])
    let coverage = 0
    for (const item of Object.values(catalogue.items)) {
      if (item.kind !== "unique" || !item.runeforging) continue
      coverage++
      const reachable = new Set([item.baseSlug])
      for (const path of item.runeforging.paths) {
        expect(reachable.has(path.from), item.name).toBe(true)
        expect(path.to).not.toBe(path.from)
        const output = catalogue.items[path.to] as BaseReference
        expect(output.kind).toBe("base")
        expect(output.itemClass).toBe(item.itemClass)
        expect(output.form).not.toBe("original")
        reachable.add(path.to)
      }
    }
    expect(coverage).toBeGreaterThan(200)
  })
})
