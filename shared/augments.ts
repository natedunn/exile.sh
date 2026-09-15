export type AugmentReference = {
  type: string
  level?: number
  limit?: number
  applications: { slot: string; lines: string[]; bonded: string[] }[]
}
export type AugmentCatalogue = Record<string, AugmentReference>

export function findAugment(
  catalogue: AugmentCatalogue | undefined,
  name: string
) {
  if (catalogue?.[name]) return catalogue[name]
  // The artwork export retains accents that PoB can omit (e.g. Mjölner).
  const key = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
  const matches = Object.entries(catalogue ?? {}).filter(
    ([candidate]) => key(candidate) === key(name)
  )
  return matches.length === 1 ? matches[0][1] : undefined
}

const slotLabels: Record<string, string> = {
  weapon: "Martial Weapons",
  armour: "Armour",
  caster: "Wands, Staves and Sceptres",
  wand: "Wands",
  staff: "Staves",
  sceptre: "Sceptres",
  helmet: "Helmets",
  "body armour": "Body Armour",
  gloves: "Gloves",
  boots: "Boots",
  shield: "Shields",
  buckler: "Bucklers",
  focus: "Foci",
  bow: "Bows",
  crossbow: "Crossbows",
  spear: "Spears",
  quarterstaff: "Quarterstaves",
  talisman: "Talismans",
  "one hand mace": "One-handed Maces",
  "two hand mace": "Two-handed Maces",
  "martial weapon wand or staff": "Martial Weapons, Wands and Staves",
}

export function augmentTypeLabel(type: string) {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2")
}

/** Merge only applications whose complete base and Bonded effects agree. */
export function augmentApplications(reference: AugmentReference) {
  const groups = new Map<
    string,
    { slots: string[]; lines: string[]; bonded: string[] }
  >()
  for (const { slot, lines, bonded } of reference.applications) {
    const key = JSON.stringify([lines, bonded])
    const group = groups.get(key) ?? { slots: [], lines, bonded }
    group.slots.push(slotLabels[slot] ?? slot)
    groups.set(key, group)
  }
  return [...groups.values()]
}
