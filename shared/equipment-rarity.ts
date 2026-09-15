import { EQUIPMENT_SLOTS, joinWrappedLines } from "./equipment"
import { jewelLines } from "./tree-jewels"
import type { BuildSnapshot } from "./pob"

/** Sum literal, unconditional rarity modifiers on worn gear. This deliberately
 * excludes passives, jewels, temporary effects, ranges and modifier scaling. */
export function equipmentRarity(
  build: Pick<BuildSnapshot, "items">,
  gear: BuildSnapshot["itemSets"][number] | undefined,
  weapons: "primary" | "swap" = "primary"
) {
  if (!gear) return undefined
  const slots = new Set<string>(
    EQUIPMENT_SLOTS.filter(({ name }) => !/^(Flask|Charm)/.test(name)).map(
      ({ name }) =>
        name.startsWith("Weapon") && weapons === "swap" ? `${name} Swap` : name
    )
  )
  let total = 0
  for (const slot of gear.slots.filter((entry) => slots.has(entry.name))) {
    if (!slot.itemId || slot.itemId === "0") continue
    const item = build.items.find((entry) => entry.id === slot.itemId)
    if (!item) return undefined
    for (const line of joinWrappedLines(
      jewelLines(item).map((entry) =>
        entry.replace(
          /\{(?:crafted|enchant|rune|fractured|desecrated|mutated|implicit)\}/g,
          ""
        )
      )
    )) {
      const match = line.match(
        /^([+-]?\d+(?:\.\d+)?)% (increased|reduced) Rarity of Items found$/i
      )
      if (match)
        total +=
          Number(match[1]) * (match[2].toLowerCase() === "reduced" ? -1 : 1)
    }
  }
  return total
}
