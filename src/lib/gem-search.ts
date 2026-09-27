import type { GemReference } from "../../shared/gems"

export type GemSearchIndex = Record<string, string[]>

export function findGems(
  references: GemReference[],
  index: GemSearchIndex | undefined,
  query: string
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return references
    .flatMap((reference) => {
      const effects = index?.[reference.skillId] ?? []
      const haystack = [
        reference.name,
        reference.type,
        reference.tags,
        reference.description,
        ...effects,
      ]
        .join(" ")
        .toLocaleLowerCase()
      if (!terms.every((term) => haystack.includes(term))) return []
      const match = terms.length
        ? effects.find((line) =>
            terms.some((term) => line.toLocaleLowerCase().includes(term))
          )
        : undefined
      const nameMatch =
        terms.length > 0 &&
        terms.every((term) => reference.name.toLocaleLowerCase().includes(term))
      return [{ reference, match, nameMatch }]
    })
    .sort(
      (a, b) =>
        Number(b.nameMatch) - Number(a.nameMatch) ||
        a.reference.name.localeCompare(b.reference.name)
    )
}
