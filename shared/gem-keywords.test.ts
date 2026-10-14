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
})
