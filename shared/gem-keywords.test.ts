import { describe, expect, it } from "vitest"
import type snapshotType from "../public/gems/v1/keywords.json"
import type labelsType from "../public/gems/v1/keyword-aliases.json"
import { readDataJson } from "./data-test-files"
import { keywordIndex } from "../src/lib/gem-keywords"

const snapshot = readDataJson<typeof snapshotType>(
  "../public/gems/v1/keywords.json"
)
const labels = readDataJson<typeof labelsType>(
  "../public/gems/v1/keyword-aliases.json"
)
const index = keywordIndex({ ...labels, keywords: snapshot.keywords })

function matches(text: string) {
  return Array.from(text.matchAll(index.pattern), ([label]) => ({
    label,
    key: index.aliases.get(label.toLowerCase()),
  }))
}

describe("gem keyword matching", () => {
  it("keeps Power Charge intact in Abiding Hex effects", () => {
    expect(matches("Supported Skills consume a Power Charge on use")).toEqual([
      { label: "consume", key: "Consume" },
      { label: "Power Charge", key: "Charges" },
    ])
  })

  it.each(["Power", "Frenzy", "Endurance"])(
    "matches singular and plural %s Charges before individual words",
    (type) => {
      expect(matches(`${type} Charge, ${type.toUpperCase()} CHARGES.`)).toEqual(
        [
          { label: `${type} Charge`, key: "Charges" },
          { label: `${type.toUpperCase()} CHARGES`, key: "Charges" },
        ]
      )
    }
  )

  it("still recognizes standalone words and other longer phrases", () => {
    expect(matches("Power, Charge, Energy Shield Recharge Rate")).toEqual([
      { label: "Power", key: "Power" },
      { label: "Charge", key: "Charges" },
      { label: "Energy Shield Recharge Rate", key: "ESRechargeRate" },
    ])
  })

  it("requires word boundaries and preserves the original text", () => {
    expect(matches("superpower chargesmith")).toEqual([])
    const text = "Gain (Power Charges), then consume a Power Charge."
    expect(text.split(index.pattern).join("")).toBe(text)
  })

  it("only matches aliases with an available definition", () => {
    const empty = keywordIndex({ keywords: {}, aliases: {}, descriptions: {} })
    expect("Power Charge".split(empty.pattern)).toEqual(["Power Charge"])
  })

  it("links Gain only where it means damage gained as extra", () => {
    const gains = (text: string) =>
      matches(text).filter((match) => match.key === "Gain")
    expect(gains("Gain Overencumbrance when you Dodge Roll")).toEqual([])
    expect(gains("Gain 10% of Damage as Extra Fire Damage")).toEqual([
      { label: "Gain", key: "Gain" },
    ])
    // The phrase must sit in the same sentence.
    expect(gains("Gains 20% as Extra Lightning Damage. Gain 5 Rage")).toEqual([
      { label: "Gains", key: "Gain" },
    ])
  })

  it("drops labels that only name a keyword in context", () => {
    const keys = (text: string) => matches(text).map((match) => match.key)
    // "[ManaLeech|Mana]" belongs to leech lines, not every "Mana".
    expect(
      keys("Recover Life equal to 15% of Mana Flask's Recovery Amount")
    ).toEqual(["Flask"])
    // Plurals and endings of a keyword still match.
    expect(keys("Banners and Seals")).toEqual(["Banner", "Seal"])
  })

  it("leaves labels the game never links as plain text", () => {
    expect(matches("+(100-150) to maximum Energy Shield")).toEqual([
      { label: "Energy Shield", key: "EnergyShield" },
    ])
    expect(matches("20% increased Area of Effect")).not.toContainEqual(
      expect.objectContaining({ label: "increased Area of Effect" })
    )
  })

  it("links relabelled words to the game's own keyword", () => {
    expect(matches("Empowered Attacks")[0]).toEqual({
      label: "Empowered",
      key: "Empowered",
    })
  })
})
