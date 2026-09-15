import type { BuildSnapshot } from "./pob"
import skillNames from "./gem-name-aliases.json"

const aliases: Record<string, string[] | undefined> = skillNames.aliases

export type SavedGem =
  BuildSnapshot["skillSets"][number]["skills"][number]["gems"][number]
export type GemReference = {
  name: string
  gameId: string
  skillId: string
  variantId: string
  description: string
  tags: string
  type: string
  support: boolean
  color: number
  image: string
  castTime?: number
}
export type GemCatalogue = {
  version: string
  gems: Record<string, GemReference>
}
export function findGem(catalogue: GemCatalogue | undefined, gem: SavedGem) {
  if (!catalogue) return undefined
  const refs = Object.values(catalogue.gems)
  if (gem.gemId) {
    const matches = refs.filter((ref) => ref.gameId === gem.gemId)
    const variant = matches.find((ref) => ref.variantId === gem.variantId)
    if (variant) return variant
    if (matches.length === 1) return matches[0]
    if (Object.hasOwn(catalogue.gems, gem.gemId))
      return catalogue.gems[gem.gemId]
  }
  if (gem.skillId) {
    const match = refs.find((ref) => ref.skillId === gem.skillId)
    if (match) return match
  }
  return findNamedGem(catalogue, gem.name, gem.support)
}

export function findNamedGem(
  catalogue: GemCatalogue | undefined,
  name: string,
  support = false
) {
  const refs = Object.values(catalogue?.gems ?? {})
  const matches = refs.filter(
    (ref) =>
      ref.name.toLowerCase() === name.toLowerCase() && ref.support === support
  )
  if (matches.length) return matches.length === 1 ? matches[0] : undefined
  // Item exports use the underlying skill name, which can differ from its gem
  // name. Resolve only source-declared aliases, never fuzzy/suffix matches.
  const skillIds = aliases[name.toLowerCase()]
  if (!skillIds) return undefined
  const alternate = refs.filter(
    (ref) => skillIds.includes(ref.skillId) && ref.support === support
  )
  return alternate.length === 1 ? alternate[0] : undefined
}

export type GemEffectLines = { lines: string[]; partial: boolean }
export type GemEffects = {
  sets: Record<
    string,
    {
      label: string
      levels: Record<string, GemEffectLines>
      quality: Record<string, GemEffectLines>
    }
  >
}
export function gemEffectValues(
  effects: GemEffects | undefined,
  gem: SavedGem
) {
  const level =
    Number(gem.level) + (gem.corrupted ? Number(gem.corruptLevel || 0) : 0)
  const quality = Number(gem.quality)
  const set = effects?.sets[savedDefault(gem.statSetIndex, "1")]
  return {
    label: set?.label,
    level,
    base:
      gem.level && Number.isInteger(level) && level > 0
        ? set?.levels[String(level)]
        : undefined,
    quality:
      gem.quality && Number.isInteger(quality) && quality > 0
        ? set?.quality[String(quality)]
        : undefined,
    missingQuality:
      !gem.quality ||
      !Number.isInteger(quality) ||
      quality < 0 ||
      quality > 100,
  }
}

export type SavedSkillGroup =
  BuildSnapshot["skillSets"][number]["skills"][number]

/** Explicit flags take precedence; only generated sources have authoritative slots. */
function skillWeaponSets(group: SavedSkillGroup) {
  let slotSets: [boolean, boolean] | undefined
  if (
    /^Item:[^:]+:.+$/.test(group.source ?? "") ||
    group.source === "Default Attack"
  ) {
    if (/^Weapon [12] Swap$/.test(group.slot)) slotSets = [false, true]
    else if (/^Weapon [12]$/.test(group.slot)) slotSets = [true, false]
  }
  return [group.set1 ?? slotSets?.[0], group.set2 ?? slotSets?.[1]] as const
}

// PoB serializes an unset numeric selection as "nil" in some exports.
function savedDefault(value: string | undefined, fallback: string) {
  return !value || value === "nil" ? fallback : value
}

/** Display saved provenance without merging groups or inferring skill identity. */
export function skillGroupLabels(group: SavedSkillGroup) {
  const labels: string[] = []
  const itemSource = group.source?.match(/^Item:[^:]+:(.+)$/)
  if (itemSource) labels.push(`Granted by ${itemSource[1]}`)
  else if (group.source === "Default Attack") labels.push("Default attack")
  else if (group.source) labels.push(`Source: ${group.source}`)

  const [set1, set2] = skillWeaponSets(group)
  if (set1 !== undefined && set2 !== undefined) {
    const weaponSet =
      set1 && set2
        ? "Weapon sets I & II"
        : set1
          ? "Weapon set I"
          : set2
            ? "Weapon set II"
            : "Unavailable in either weapon set"
    if (labels.length && (set1 || set2)) labels[0] += ` in ${weaponSet}`
    else labels.push(weaponSet)
  }
  if (!group.enabled) labels.push("Disabled")
  return labels
}

/** Fold bare item grants into a single matching setup, without changing the export. */
export function displaySkillGroups(
  skills: SavedSkillGroup[],
  mainSocketGroup: number
) {
  const groups = skills
    .map((skill, i) => ({
      skill,
      i,
      main: i === mainSocketGroup - 1,
      grants: [] as SavedSkillGroup[],
    }))
    .filter(({ skill }) => !skill.removed)
  const hidden = new Set<number>()
  for (const entry of groups) {
    const source = entry.skill
    const granted = source.gems[0]
    if (
      !source.source?.startsWith("Item:") ||
      source.gems.length !== 1 ||
      !granted.skillId ||
      granted.support
    )
      continue
    const sourceSets = skillWeaponSets(source)
    const matches = groups.filter(
      ({ skill }) =>
        !skill.source &&
        skill.enabled === source.enabled &&
        // A multi-active/meta setup is not an unambiguous owner of an item grant.
        skill.gems.filter((gem) => !gem.support).length === 1 &&
        skill.gems.some(
          (gem) =>
            !gem.support &&
            gem.skillId === granted.skillId &&
            gem.level === granted.level &&
            gem.quality === granted.quality &&
            gem.enabled === granted.enabled &&
            savedDefault(gem.variantId, "") ===
              savedDefault(granted.variantId, "") &&
            savedDefault(gem.statSetIndex, "1") ===
              savedDefault(granted.statSetIndex, "1") &&
            (gem.corrupted ?? false) === (granted.corrupted ?? false) &&
            savedDefault(gem.corruptLevel, "0") ===
              savedDefault(granted.corruptLevel, "0")
        ) &&
        // An unspecified configured set imposes no restriction. An explicit
        // restriction must be established by the generated source as well.
        skillWeaponSets(skill).every(
          (enabled, index) =>
            enabled === undefined || enabled === sourceSets[index]
        )
    )
    if (matches.length !== 1) continue
    matches[0].grants.push(source)
    matches[0].main ||= entry.main
    hidden.add(entry.i)
  }
  return groups.filter((entry) => !hidden.has(entry.i))
}
