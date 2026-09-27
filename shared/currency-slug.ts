import catalog from "./catalog.json"

/* Readable currency URLs: the item's name in kebab case, e.g.
 * /currency/chaos-orb. When two catalogue entries share a name, each takes
 * its metadata id's last segment as a suffix so neither claims the plain
 * slug. Items missing from the catalogue fall back to that segment alone.
 * Slugs derive from the pinned catalogue, so they stay stable until it
 * changes. */

function kebab(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const lastSegment = (id: string) => id.split("/").at(-1) ?? id

const byId = new Map<string, string>()
const bySlug = new Map<string, string>()
const groups = new Map<string, string[]>()
for (const { id, name } of catalog) {
  const base = kebab(name)
  groups.set(base, [...(groups.get(base) ?? []), id])
}
for (const [base, ids] of groups)
  for (const id of ids) {
    const slug = ids.length === 1 ? base : `${base}-${kebab(lastSegment(id))}`
    byId.set(id, slug)
    bySlug.set(slug, id)
  }

export function currencySlug(id: string) {
  return byId.get(id) ?? kebab(lastSegment(id))
}

/** The item id for a slug. `known` covers ids the market reports that the
 * catalogue does not list yet. */
export function currencyBySlug(slug: string, known: Iterable<string> = []) {
  const id = bySlug.get(slug)
  if (id) return id
  for (const candidate of known)
    if (currencySlug(candidate) === slug) return candidate
  return undefined
}
