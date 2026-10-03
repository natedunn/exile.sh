import type { GemCatalogue, GemReference } from "./gems"
import { gemSlug } from "./gem-slug"

export type GemCompatibility = {
  sourceRevision: string
  skills: string[]
  supports: Partial<Record<string, number[]>>
}

export type CompatibleGem = { reference: GemReference; slug: string }

/** Resolve links using the complete catalogue so colliding names keep their slugs. */
export function compatibleGems(
  gem: GemReference,
  catalogue: GemCatalogue,
  data: GemCompatibility
): CompatibleGem[] | null {
  let references: GemReference[]
  if (gem.support) {
    const skills = data.supports[gem.skillId]
    if (!skills) return null
    references = skills.flatMap((number) => {
      const key = data.skills[number]
      const reference =
        key && Object.hasOwn(catalogue.gems, key)
          ? catalogue.gems[key]
          : undefined
      return reference ? [reference] : []
    })
  } else {
    const skillIndex = data.skills.findIndex(
      (key) =>
        Object.hasOwn(catalogue.gems, key) &&
        catalogue.gems[key].skillId === gem.skillId
    )
    if (skillIndex < 0) return null
    references = Object.values(catalogue.gems).filter(
      (reference) =>
        reference.support &&
        data.supports[reference.skillId]?.includes(skillIndex)
    )
  }
  return references.map((reference) => ({
    reference,
    slug: gemSlug(catalogue, reference),
  }))
}
