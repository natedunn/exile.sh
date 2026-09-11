import art from "./equipment-art.json"
import socketArt from "./socket-art.json"
import type { BuildSnapshot } from "./pob"

const socketImages: Record<string, string | undefined> = socketArt

type Artwork = {
  image: string
  itemClass: string
  width: number
  height: number
}
const bases: Record<string, Artwork | undefined> = art.bases
const uniques: Record<string, Artwork | undefined> = art.uniques
const baseNames = Object.keys(bases).sort((a, b) => b.length - a.length)
export type EquipmentItem = BuildSnapshot["items"][number]
export type ItemLine = {
  text: string
  kind: "normal" | "crafted" | "enchant" | "fractured" | "desecrated"
}
export function describeEquipment(item: EquipmentItem) {
  const lines = item.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const rarity = item.rarity.toUpperCase()
  const name = lines.at(1) || item.name
  // Rare/unique names are generated or named identities; ordinary/magic items
  // may have their base name on the first name line, with affixes around it.
  const candidates =
    rarity === "RARE" || rarity === "UNIQUE" ? [lines.at(2) || ""] : [name]
  let base = candidates.find((line) => bases[line]) || ""
  if (!base)
    base =
      baseNames.find((n) =>
        candidates.some(
          (line) =>
            line === n ||
            line.startsWith(n + " of ") ||
            line.endsWith(" " + n) ||
            line.includes(" " + n + " of ")
        )
      ) || ""
  const unique =
    rarity === "UNIQUE"
      ? uniques[name + "|" + base] || uniques[name]
      : undefined
  const artwork = unique || bases[base]
  const body = lines.slice(rarity === "RARE" || rarity === "UNIQUE" ? 3 : 2)
  const properties: string[] = [],
    requirements: string[] = [],
    modifiers: ItemLine[] = [],
    sockets: string[] = []
  let socketCount = 0
  let variantWarning = false
  for (const line of body) {
    if (
      /^(Unique ID|Item Level|League|Crafted|Prefix|Suffix|Selected Variant|Variant|Implicits|Radius|Limited to):/.test(
        line
      )
    ) {
      if (/Variant:/.test(line)) variantWarning = true
      // Jewel radius and limits are gameplay properties, not export metadata.
      if (/^(Radius|Limited to):/.test(line)) properties.push(line)
      continue
    }
    if (line.startsWith("Sockets:")) {
      socketCount = (line.slice(8).match(/[A-Z]/g) || []).length
      continue
    }
    if (/^(Rune|Soul Core):/.test(line)) {
      sockets.push(line)
      continue
    }
    if (/^(LevelReq|StrReq|DexReq|IntReq):/.test(line)) {
      requirements.push(
        line
          .replace("LevelReq:", "Level")
          .replace("StrReq:", "Strength")
          .replace("DexReq:", "Dexterity")
          .replace("IntReq:", "Intelligence")
      )
      continue
    }
    if (
      /^(Quality|Armour|Evasion|Energy Shield|Ward|Spirit|Physical Damage|Elemental Damage|Chaos Damage|Critical Hit Chance|Attacks per Second|Weapon Range|Block chance|Requires|Charges|Recovers|Lasts):/i.test(
        line
      )
    ) {
      properties.push(line)
      continue
    }
    if (/\{variant:/.test(line)) variantWarning = true
    const kind = line.includes("{desecrated}")
      ? "desecrated"
      : line.includes("{fractured}")
        ? "fractured"
        : line.includes("{crafted}")
          ? "crafted"
          : /\{(enchant|rune)\}/.test(line)
            ? "enchant"
            : "normal"
    // Strip only presentation tags. Variant/range markers remain visible because
    // the viewer must not silently pick or recalculate a variant's modifiers.
    const text = line.replace(
      /\{(?:crafted|enchant|rune|fractured|desecrated|implicit)\}/g,
      ""
    )
    if (text !== "--------") modifiers.push({ text, kind })
  }
  return {
    name,
    base,
    rarity,
    artwork,
    properties,
    requirements,
    modifiers,
    sockets,
    socketCount,
    socketContents: Array.from(
      { length: Math.min(Math.max(socketCount, sockets.length), 6) },
      (_, index) => {
        const socketName = sockets[index]?.replace(/^(Rune|Soul Core):\s*/, "")
        const empty = socketName === "None" || socketName === "Empty"
        return {
          name: empty ? "Empty socket" : socketName || "Unspecified socket",
          image: socketName && !empty ? socketImages[socketName] : undefined,
        }
      }
    ),
    variantWarning,
  }
}
export type EquipmentDetails = ReturnType<typeof describeEquipment>
export const EQUIPMENT_SLOTS = [
  { name: "Weapon 1", label: "Main hand", area: "weapon" },
  { name: "Weapon 2", label: "Off hand", area: "offhand" },
  { name: "Helmet", label: "Helmet", area: "helmet" },
  { name: "Body Armour", label: "Body armour", area: "body" },
  { name: "Amulet", label: "Amulet", area: "amulet" },
  { name: "Ring 1", label: "Left ring", area: "ring-left" },
  { name: "Ring 2", label: "Right ring", area: "ring-right" },
  { name: "Gloves", label: "Gloves", area: "gloves" },
  { name: "Belt", label: "Belt", area: "belt" },
  { name: "Boots", label: "Boots", area: "boots" },
  { name: "Flask 1", label: "Life flask", area: "flask-life" },
  { name: "Flask 2", label: "Mana flask", area: "flask-mana" },
  { name: "Charm 1", label: "Charm 1", area: "charm-one" },
  { name: "Charm 2", label: "Charm 2", area: "charm-two" },
  { name: "Charm 3", label: "Charm 3", area: "charm-three" },
] as const
