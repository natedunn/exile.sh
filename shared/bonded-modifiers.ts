import type { BuildSnapshot } from "./pob"

// Wisdom of the Maji in the bundled 0_4 and 0_5 passive trees:
// Shaman — "Gain the benefits of Bonded modifiers on Runes and Idols".
const wisdomOfTheMaji: Record<string, string | undefined> = {
  "0_4": "42253",
  "0_5": "42253",
}

export function hasBondedModifiers(
  spec: BuildSnapshot["treeSpecs"][number] | undefined,
  weapons: "primary" | "swap"
) {
  if (!spec) return false
  const node = wisdomOfTheMaji[spec.version]
  if (!node || !spec.nodes.includes(node)) return false
  const active = weapons === "primary" ? spec.weaponSet1 : spec.weaponSet2
  const inactive = weapons === "primary" ? spec.weaponSet2 : spec.weaponSet1
  return !inactive?.includes(node) || !!active?.includes(node)
}
