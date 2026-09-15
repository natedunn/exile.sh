import { expect, test } from "vitest"
import { equipmentRarity } from "./equipment-rarity"
import { formattedStat, statCategory, statLabel } from "./build-stat-format"

const item = (id: string, mods: string) => ({
  id,
  name: "Test",
  rarity: "RARE",
  text: `Rarity: RARE\nTest\nGold Ring\n${mods}`,
})
test("rarity uses worn gear, selected weapons and selected variants only", () => {
  const items = [
    item(
      "1",
      "10% increased Rarity of Items found\n{rune}5% increased Rarity of Items found\n8% increased Rarity of Items found while on Low Life\n{range:0.5}(10-20)% increased Rarity of Items found"
    ),
    item("2", "20% increased Rarity of Items found"),
    item(
      "3",
      "Selected Variant: 2\n{variant:1}100% increased Rarity of Items found\n{variant:2}3% reduced Rarity of Items found"
    ),
    item("4", "200% increased Rarity of Items found"),
  ]
  const gear = {
    id: "1",
    title: "Test",
    slots: [
      { name: "Ring 1", itemId: "1" },
      { name: "Weapon 1", itemId: "2" },
      { name: "Weapon 1 Swap", itemId: "3" },
      { name: "Flask 1", itemId: "4" },
      { name: "Jewel Socket 1", itemId: "4" },
    ],
  }
  expect(equipmentRarity({ items }, gear)).toBe(35)
  expect(equipmentRarity({ items }, gear, "swap")).toBe(12)
  expect(equipmentRarity({ items }, { ...gear, slots: [] })).toBe(0)
  expect(equipmentRarity({ items: [] }, gear)).toBeUndefined()
  expect(equipmentRarity({ items }, undefined)).toBeUndefined()
})
test("expanded stats retain units, zero, missing values and readable acronyms", () => {
  expect(formattedStat("LootRarity", "0")).toBe("0%")
  expect(formattedStat("EffectiveMovementSpeedMod", "1.2")).toBe("120%")
  expect(formattedStat("CritMultiplier", "2.5")).toBe("2.5×")
  expect(formattedStat("ManaPercentPerSecondCost", "2")).toBe("2%/s")
  expect(formattedStat("ManaPerSecondCost", "20")).toBe("20/s")
  expect(formattedStat("LootRarity", "")).toBe("—")
  expect(statLabel("EnergyShieldLeechGainRate")).toBe(
    "Energy Shield Leech Gain Rate"
  )
  expect(statCategory("PhysicalDamageReduction")).toBe("Defences & resources")
  expect(statCategory("LifeLeechGainPerHit")).toBe("Recovery")
})
