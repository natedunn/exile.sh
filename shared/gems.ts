import type { BuildSnapshot } from "./pob"

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
  const matches = refs.filter(
    (ref) =>
      ref.name.toLowerCase() === gem.name.toLowerCase() &&
      ref.support === gem.support
  )
  return matches.length === 1 ? matches[0] : undefined
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
  const set = effects?.sets[gem.statSetIndex || "1"]
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
