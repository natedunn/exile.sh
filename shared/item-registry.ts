export type BaseReference = {
  id: string
  slug: string
  kind: "base"
  form: "original" | "runeforged" | "runemastered"
  name: string
  itemClass: string
  domain: string
  tags: string[]
  image: string
  dropLevel: number
  requirements: Record<string, number>
  properties: Record<string, unknown>
  implicits: string[]
}

export type UniqueReference = {
  slug: string
  kind: "unique"
  name: string
  baseName: string
  baseSlug: string | null
  itemClass: string
  image: string
  variants: { id: number; name: string }[]
  complex: boolean
  implicitCount: number
  modifiers: { text: string; variants: number[] }[]
  metadata: string[]
  runeforging?: {
    source: string
    sourceVersion: string
    paths: { from: string; to: string; craftId: number }[]
  }
}

export type ItemReference = BaseReference | UniqueReference
export type ItemCatalogue = {
  version: string
  items: Record<string, ItemReference>
}
export type ModifierReference = {
  id: string
  name: string
  text: string
  level: number
  affix: "prefix" | "suffix" | "corrupted" | "instilled"
  groups: string[]
  tags: string[]
  addsTags: string[]
  domain: string
  eligibility: { tag: string; allowed: boolean }[]
  source:
    | "normal"
    | "essence"
    | "desecrated"
    | "corruption"
    | "instilling"
    /** Orb of Sacrifice: an upgraded corruption implicit. */
    | "sacrifice"
}
export type EssenceReference = {
  id: string
  name: string
  type: string
  level: number
  /** Per item class, the modifiers the essence can add. A "one of"
   * essence lists every outcome; the base decides which can roll. */
  mods: Record<
    string,
    { id: string; text: string; affix: "prefix" | "suffix" }[]
  >
}
export type AugmentReference = {
  id: string
  name: string
  type: string
  level: number
  image: string
  effects: { slot: string; text: string[]; bonded: string[] }[]
}
export type ModifierCatalogue = {
  mods: Record<string, ModifierReference>
  essences: EssenceReference[]
  augments: AugmentReference[]
  /** Augment slot names (such as "Martial Weapon") to item classes. */
  augmentSlots: Record<string, string[]>
  influences: InfluenceReference[]
}

/** An influence's modifiers spawn only once its warp rune is socketed, and
 * the rune fits one item class family. */
export type InfluenceReference = {
  tag: string
  label: string
  rune: string
  classes: string[]
}

export function uniqueModifiers(item: UniqueReference, variant: number) {
  const valid = item.variants.some((option) => option.id === variant)
  const selected = valid ? variant : item.variants[0]?.id
  return item.modifiers.filter(
    (mod) => !mod.variants.length || mod.variants.includes(selected)
  )
}

/** The first matching tag wins, including explicit exclusions. Boolean
 * eligibility is intentionally separate from unknown spawn probabilities. */
export function modifierMatchesBase(
  mod: ModifierReference,
  base: BaseReference,
  /** Tags the item gains from a mechanic, such as an influence. */
  addedTags: string[] = []
) {
  if (
    mod.domain !== base.domain &&
    !(mod.domain === "desecrated" && ["item", "misc"].includes(base.domain))
  )
    return false
  return (
    mod.eligibility.find(
      (entry) => base.tags.includes(entry.tag) || addedTags.includes(entry.tag)
    )?.allowed === true
  )
}

/** Influences add a tag to the item that unlocks their own modifier pool.
 * No base carries these tags, so their modifiers never match unaided. */
export function modifierInfluence(
  mod: ModifierReference,
  influences: InfluenceReference[]
) {
  return influences.find((influence) =>
    mod.eligibility.some(
      (entry) => entry.allowed && entry.tag === influence.tag
    )
  )
}

/** The influences whose warp rune fits this base, so whose pools it can
 * roll. Each pool still applies its own weights to the base's tags. */
export function baseInfluences(
  catalogue: ModifierCatalogue,
  base: BaseReference
) {
  return catalogue.influences.filter((influence) =>
    influence.classes.includes(base.itemClass)
  )
}

const indexes = new WeakMap<ItemCatalogue, Map<string, string>>()
export function searchItems(
  catalogue: ItemCatalogue,
  query: string,
  kind: "all" | "base" | "unique",
  itemClass: string
) {
  let index = indexes.get(catalogue)
  if (!index) {
    index = new Map(
      Object.values(catalogue.items).map((item) => [
        item.slug,
        [
          item.name,
          item.itemClass,
          item.kind === "unique" ? item.baseName : item.form,
          item.kind === "base" && item.properties.ward ? "ward runic ward" : "",
          ...(item.kind === "unique"
            ? item.modifiers.map((mod) => mod.text)
            : item.implicits),
        ]
          .join(" ")
          .toLocaleLowerCase(),
      ])
    )
    indexes.set(catalogue, index)
  }
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return Object.values(catalogue.items)
    .filter(
      (item) =>
        (kind === "all" || item.kind === kind) &&
        (!itemClass || item.itemClass === itemClass) &&
        words.every((word) => index.get(item.slug)!.includes(word))
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)
    )
}

/** RePoE stores attack time in ms, critical chance/movement penalties in
 * hundredths of a percent, and flask duration in tenths of a second. */
export function baseStatRows(
  base: BaseReference
): { label: string; value: string }[] {
  const rows = [{ label: "Drop level", value: String(base.dropLevel) }]
  const props = base.properties
  const number = (key: string) =>
    typeof props[key] === "number" ? props[key] : undefined
  const armourStats = {
    armour: "Armour",
    evasion: "Evasion rating",
    energy_shield: "Energy shield",
    ward: "Runic Ward",
  }
  for (const [key, label] of Object.entries(armourStats)) {
    const value = props[key]
    if (
      value &&
      typeof value === "object" &&
      "min" in value &&
      "max" in value
    ) {
      const range = value as { min: number; max: number }
      rows.push({
        label,
        value:
          range.min === range.max
            ? String(range.min)
            : `${range.min}–${range.max}`,
      })
    }
  }
  const physicalMin = number("physical_damage_min")
  const physicalMax = number("physical_damage_max")
  if (physicalMin !== undefined && physicalMax !== undefined)
    rows.push({
      label: "Physical damage",
      value: `${physicalMin}–${physicalMax}`,
    })
  const attackTime = number("attack_time")
  if (attackTime && attackTime > 0)
    rows.push({
      label: "Attacks per second",
      value: (1000 / attackTime).toFixed(2),
    })
  const crit = number("critical_strike_chance")
  if (crit !== undefined)
    rows.push({ label: "Critical hit chance", value: `${crit / 100}%` })
  const block = number("block")
  if (block !== undefined)
    rows.push({ label: "Block chance", value: `${block}%` })
  const movement = number("movement_speed")
  if (movement)
    rows.push({ label: "Movement speed", value: `${movement / 100}%` })
  for (const [key, label] of Object.entries({
    life_per_use: "Life recovered",
    mana_per_use: "Mana recovered",
    charges_max: "Maximum charges",
    charges_per_use: "Charges per use",
  })) {
    const value = number(key)
    if (value !== undefined) rows.push({ label, value: String(value) })
  }
  const duration = number("duration")
  if (duration !== undefined)
    rows.push({ label: "Duration", value: `${duration / 10}s` })
  for (const [key, value] of Object.entries(base.requirements)) {
    if (value > 0) rows.push({ label: `Requires ${key}`, value: String(value) })
  }
  return rows
}

export function itemBySlug(
  catalogue: ItemCatalogue,
  slug: string
): ItemReference | undefined {
  return Object.hasOwn(catalogue.items, slug)
    ? catalogue.items[slug]
    : undefined
}

/** Same-name families are reference comparisons, not recipe edges. */
export function relatedBases(catalogue: ItemCatalogue, base: BaseReference) {
  const family = (name: string) =>
    name.replace(/^(Runeforged|Runemastered) /, "")
  return Object.values(catalogue.items)
    .filter(
      (item): item is BaseReference =>
        item.kind === "base" &&
        item.itemClass === base.itemClass &&
        family(item.name) === family(base.name)
    )
    .sort(
      (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)
    )
}

/** Only reviewed recipe outputs can be chosen for a unique. */
export function uniqueBaseForms(
  catalogue: ItemCatalogue,
  item: UniqueReference
) {
  const slugs = new Set([
    item.baseSlug,
    ...(item.runeforging?.paths.map((path) => path.to) ?? []),
  ])
  return [...slugs].flatMap((slug) => {
    const base = slug ? itemBySlug(catalogue, slug) : undefined
    return base?.kind === "base" ? [base] : []
  })
}

/** Tiers of one modifier family: the same group and affix, best first. */
export type ModifierFamily = {
  key: string
  tiers: ModifierReference[]
}

/** Tier one is the highest required level, as in game. */
export function modifierFamilies(mods: ModifierReference[]): ModifierFamily[] {
  const families = new Map<string, ModifierReference[]>()
  for (const mod of mods) {
    // A group can hold alternatives at the same level (Soul's Spirit and
    // Mana hybrids), so the wording without numbers is part of the key.
    const wording = mod.text.replace(/[-+\d.()%]/g, "")
    const key = `${mod.affix}:${mod.groups.join("+") || mod.id}:${wording}`
    const tiers = families.get(key)
    if (tiers) tiers.push(mod)
    else families.set(key, [mod])
  }
  return [...families].map(([key, tiers]) => ({
    key,
    tiers: tiers.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id)),
  }))
}

export type EssenceOutcome = {
  /** The modifier the essence adds. */
  id: string
  essence: string
  type: string
  level: number
  text: string
  affix: "prefix" | "suffix"
}

/** A "one of" essence keeps the outcomes this base can roll: Essence of
 * Enhancement adds Energy Shield to an Intelligence base, not Armour.
 * Essence-only outcomes spawn on no base by weight and are all kept. */
export function essenceOutcomes(
  catalogue: ModifierCatalogue,
  base: BaseReference
): EssenceOutcome[] {
  return catalogue.essences.flatMap((essence) => {
    const outcomes = Object.hasOwn(essence.mods, base.itemClass)
      ? essence.mods[base.itemClass]
      : []
    const rollable =
      outcomes.length > 1
        ? outcomes.filter((outcome) => {
            const mod = Object.hasOwn(catalogue.mods, outcome.id)
              ? catalogue.mods[outcome.id]
              : undefined
            // A modifier no base can spawn exists only on essences.
            return (
              !mod ||
              mod.eligibility.every((entry) => !entry.allowed) ||
              modifierMatchesBase(mod, base)
            )
          })
        : outcomes
    return rollable.map((outcome) => ({
      id: outcome.id,
      essence: essence.name,
      type: essence.type,
      level: essence.level,
      text: outcome.text,
      affix: outcome.affix,
    }))
  })
}

export type AugmentOutcome = Omit<AugmentReference, "effects"> & {
  text: string[]
  bonded: string[]
}

/** An augment can name the class directly and through a family such as
 * "Armour"; both effects apply, so they are combined. */
export function augmentOutcomes(
  catalogue: ModifierCatalogue,
  itemClass: string
): AugmentOutcome[] {
  return catalogue.augments.flatMap(({ effects, ...augment }) => {
    const matching = effects.filter(
      (effect) =>
        Object.hasOwn(catalogue.augmentSlots, effect.slot) &&
        catalogue.augmentSlots[effect.slot].includes(itemClass)
    )
    return matching.length
      ? [
          {
            ...augment,
            text: matching.flatMap((effect) => effect.text),
            bonded: matching.flatMap((effect) => effect.bonded),
          },
        ]
      : []
  })
}
