import type { GemCatalogue, GemReference } from "./gems"

/* Readable gem URLs: the gem's name in kebab case, e.g. /gems/lightning-arrow.
 * Template names drop their placeholder ("Spectre: {0}" → spectre). When
 * names clash, a support sharing a skill's name takes "-support"; among
 * same-kind clashes the gem whose skill id spells its name keeps the plain
 * slug and the rest append their skill id. Slugs derive from the pinned
 * catalogue, so they stay stable until the catalogue revision changes. */

function kebab(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\{\d+\}/g, "")
      .replace(/['’]/g, "")
      // Split camel case: SupportUnleash → Support-Unleash, Melee2HMace → Melee-2H-Mace.
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
      .replace(/([A-Z0-9])([A-Z][a-z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  )
}

const skillName = (reference: GemReference) =>
  reference.skillId.replace(/Player$/, "").replace(/^Support/, "")

type SlugIndex = {
  bySlug: Map<string, GemReference>
  bySkillId: Map<string, string>
}
const indexes = new WeakMap<GemCatalogue, SlugIndex>()

function slugIndex(catalogue: GemCatalogue): SlugIndex {
  const cached = indexes.get(catalogue)
  if (cached) return cached
  const groups = new Map<string, GemReference[]>()
  for (const reference of Object.values(catalogue.gems)) {
    if (!reference.gameId) continue
    const base = kebab(reference.name)
    groups.set(base, [...(groups.get(base) ?? []), reference])
  }
  const index: SlugIndex = { bySlug: new Map(), bySkillId: new Map() }
  const assign = (slug: string, reference: GemReference) => {
    index.bySlug.set(slug, reference)
    index.bySkillId.set(reference.skillId, slug)
  }
  for (const [base, group] of groups) {
    const mixed = group.some((r) => r.support) && group.some((r) => !r.support)
    for (const kind of [false, true]) {
      const members = group
        .filter((r) => r.support === kind)
        .sort((a, b) => a.skillId.localeCompare(b.skillId))
      if (!members.length) continue
      const slug = mixed && kind ? `${base}-support` : base
      const plain =
        members.find(
          (r) => skillName(r).toLowerCase() === base.replaceAll("-", "")
        ) ?? members[0]
      for (const reference of members)
        assign(
          reference === plain ? slug : `${slug}-${kebab(skillName(reference))}`,
          reference
        )
    }
  }
  indexes.set(catalogue, index)
  return index
}

export function gemSlug(catalogue: GemCatalogue, reference: GemReference) {
  return (
    slugIndex(catalogue).bySkillId.get(reference.skillId) ?? reference.skillId
  )
}

/** Resolves a slug, or a legacy skill id so older links still open. */
export function gemBySlug(catalogue: GemCatalogue, slug: string) {
  const index = slugIndex(catalogue)
  const bySlug = index.bySlug.get(slug)
  if (bySlug) return bySlug
  const legacy = index.bySkillId.get(slug)
  return legacy ? index.bySlug.get(legacy) : undefined
}
