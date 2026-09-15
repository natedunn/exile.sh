import definitions from "./augment-modifiers.json"
import type { EquipmentDetails, ItemLine } from "./equipment"

// PoB merges equal stats and can scale rolls. Match wording, retain saved values.
function signature(line: string) {
  return line
    .replace(/\{[^}]*\}/g, "")
    .replace(/[+-]?\d+(?:\.\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}
const augmentSignatures = new Map(
  Object.entries(definitions).map(([name, lines]) => [
    name,
    new Set(lines.map(signature)),
  ])
)
export type Augment = { name: string; image?: string; count: number }

export function groupItemAugments(details: EquipmentDetails) {
  const unique = new Map<string, Augment>()
  for (const socket of details.socketContents) {
    if (socket.name === "Empty socket" || socket.name === "Unspecified socket")
      continue
    const entry = unique.get(socket.name)
    if (entry) entry.count++
    else unique.set(socket.name, { ...socket, count: 1 })
  }
  const groups = new Map<string, { augments: Augment[]; lines: ItemLine[] }>()
  // Individual augment groups exist even when an older export omits their effects.
  for (const [name, augment] of unique)
    groups.set(name, { augments: [augment], lines: [] })
  const unmatched: ItemLine[] = []
  for (const line of details.augmentModifiers) {
    const matches = [...unique.keys()].filter((name) =>
      augmentSignatures.get(name)?.has(signature(line.text))
    )
    if (!matches.length) {
      unmatched.push(line)
      continue
    }
    // A merged stat shared by distinct augments appears once below both names.
    const key = matches.join("\n")
    const group = groups.get(key) ?? {
      augments: matches.map((name) => unique.get(name)!),
      lines: [],
    }
    group.lines.push(line)
    groups.set(key, group)
  }
  const covered = new Set(
    [...groups.values()]
      .filter((g) => g.lines.length)
      .flatMap((g) => g.augments.map((a) => a.name))
  )
  return {
    groups: [...groups.values()].filter(
      (g) => g.lines.length || !g.augments.every((a) => covered.has(a.name))
    ),
    unmatched,
  }
}

export function grantedSkillName(text: string) {
  return text
    .replace(/\{[^}]*\}/g, "")
    .match(/^Grants Skill:\s*Level\s+(?:\d+|\([\d-]+\))\s+(.+)$/i)?.[1]
}
