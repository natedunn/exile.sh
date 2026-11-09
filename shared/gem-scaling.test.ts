import { describe, expect, it } from "vitest"
import type { GemEffects } from "./gems"
import { attackDamagePercent, gemScaling } from "./gem-scaling"

const lines = (...values: string[]) => ({ lines: values, partial: false })
const set = (label: string, levels: Record<string, string[]>) => ({
  label,
  levels: Object.fromEntries(
    Object.entries(levels).map(([level, text]) => [level, lines(...text)])
  ),
  quality: {},
})

describe("attackDamagePercent", () => {
  const levels = {
    "1": { attackSpeedMultiplier: -40 },
    "2": { attackSpeedMultiplier: -40, baseMultiplier: 1.1 },
  }
  it("treats an omitted multiplier as 100%", () => {
    expect(attackDamagePercent(levels, null, 1)).toBe(100)
    expect(attackDamagePercent(levels, null, 2)).toBe(110)
  })
  it("prefers a stat set's own multiplier at that level", () => {
    const sets = { "2": { "1": 2, "2": 2.2 } }
    expect(attackDamagePercent(levels, sets, 1, "2")).toBe(200)
    expect(attackDamagePercent(levels, sets, 2, "1")).toBe(110)
  })
  it("has no value for a level without data", () => {
    expect(attackDamagePercent(levels, null, 3)).toBeUndefined()
  })
})

describe("gemScaling", () => {
  it("charts attack damage per part and names a constant attack speed once", () => {
    const effects: GemEffects = {
      sets: {
        "1": set("Initial Strike", { "1": [], "2": [] }),
        "2": set("Shockwave", { "1": [], "2": [] }),
      },
    }
    const scaling = gemScaling({
      attack: true,
      levels: {
        "1": { attackSpeedMultiplier: -40, cost: { Mana: 9 } },
        "2": {
          attackSpeedMultiplier: -40,
          baseMultiplier: 1.1,
          cost: { Mana: 10 },
        },
      },
      setMultipliers: { "2": { "1": 2, "2": 2.2 } },
      effects,
    })
    const damage = scaling.charts.find((chart) => chart.id === "attack-damage")
    expect(damage?.series.map((series) => series.label)).toEqual([
      "Initial Strike",
      "Shockwave",
    ])
    expect(damage?.series[1].points).toEqual([{ value: 200 }, { value: 220 }])
    expect(scaling.charts.map((chart) => chart.title)).toContain("Cost")
    expect(scaling.unchanged).toEqual([
      { label: "Attack speed", value: "60% of base" },
    ])
  })

  it("leaves per-part attack damage out until per-set multipliers exist", () => {
    const scaling = gemScaling({
      attack: true,
      levels: { "1": {}, "2": { baseMultiplier: 1.5 } },
      setMultipliers: null,
      effects: {
        sets: {
          "1": set("Strike", { "1": [], "2": [] }),
          "2": set("Wave", { "1": [], "2": [] }),
        },
      },
    })
    expect(scaling.charts[0].series.map((series) => series.label)).toEqual([
      "Attack damage",
    ])
  })

  it("plots hit damage ranges by their average and merges identical parts", () => {
    const deals = (low: number, high: number) =>
      `Deals ${low} to ${high} Fire Damage`
    const scaling = gemScaling({
      attack: false,
      levels: {},
      setMultipliers: {},
      effects: {
        sets: {
          "1": set("Projectile", { "1": [deals(8, 12)], "2": [deals(10, 16)] }),
          "2": set("Explosion", {
            "1": [deals(8, 12), "Explosion radius is 1.7 metres"],
            "2": [deals(10, 16), "Explosion radius is 1.7 metres"],
          }),
        },
      },
    })
    expect(scaling.charts).toHaveLength(1)
    const [chart] = scaling.charts
    expect(chart.title).toBe("Damage per hit")
    expect(chart.series).toEqual([
      {
        key: "damage-0",
        label: "Fire damage",
        points: [
          { value: 10, low: 8, high: 12 },
          { value: 13, low: 10, high: 16 },
        ],
      },
    ])
  })

  it("tracks one changing number in an effect line and keeps its unit", () => {
    const scaling = gemScaling({
      attack: false,
      levels: {},
      setMultipliers: {},
      effects: {
        sets: {
          "1": set("Shard", {
            "1": [
              "Chills Enemies as though dealing 200% more damage",
              "Shards deal up to 400% more damage 2 seconds after arming",
            ],
            "2": [
              "Chills Enemies as though dealing 290% more damage",
              "Shards deal up to 400% more damage 2 seconds after arming",
            ],
          }),
        },
      },
    })
    expect(scaling.charts).toEqual([
      {
        id: "effect:Chills Enemies as though dealing #% more damage",
        title: "Chills Enemies as though dealing #% more damage",
        unit: "%",
        series: [
          {
            key: "effect:Chills Enemies as though dealing #% more damage-0",
            label: "Chills Enemies as though dealing #% more damage",
            points: [{ value: 200 }, { value: 290 }],
          },
        ],
      },
    ])
  })

  it("splits a chart past the validated palette's three series", () => {
    const effects: GemEffects = { sets: {} }
    const multipliers: Record<string, Record<string, number>> = {}
    for (const id of ["1", "2", "3", "4"]) {
      effects.sets[id] = set(`Part ${id}`, { "1": [], "2": [] })
      multipliers[id] = { "1": Number(id), "2": Number(id) + 1 }
    }
    const scaling = gemScaling({
      attack: true,
      levels: { "1": {}, "2": {} },
      setMultipliers: multipliers,
      effects,
    })
    expect(
      scaling.charts.map((chart) => [chart.id, chart.series.length])
    ).toEqual([
      ["attack-damage-1", 3],
      ["attack-damage-2", 1],
    ])
  })
})
