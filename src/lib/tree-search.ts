import { DEFAULT_TREE_VERSION, isTreeVersion } from "../../shared/tree-versions"
import type { TreeVersion } from "../../shared/tree-versions"

/** Tree page URL state. Defaults are left out so a bare path stays bare;
 * a missing ascendancy falls back to the visitor's saved choice. */
export type TreeSearch = {
  version?: TreeVersion
  ascendancy?: string
  unseen?: true
}

function readVersion(value: unknown) {
  return isTreeVersion(value) && value !== DEFAULT_TREE_VERSION
    ? value
    : undefined
}

/** `section` is the old name, kept so earlier shared links still resolve. */
function readAscendancy(search: Record<string, unknown>) {
  const value = search.ascendancy ?? search.section
  return typeof value === "string" &&
    value !== "None" &&
    /^[a-zA-Z ]{1,50}$/.test(value)
    ? value
    : undefined
}

export function validateAscendancySearch(
  search: Record<string, unknown>
): TreeSearch {
  return {
    version: readVersion(search.version),
    ascendancy: readAscendancy(search),
  }
}

/** Paths Not Taken only exists on the Oracle centre. */
export function validatePassiveSearch(
  search: Record<string, unknown>
): TreeSearch {
  const base = validateAscendancySearch(search)
  const unseen =
    base.ascendancy === "Oracle" &&
    (search.unseen === true || search.unseen === "true")
  return { ...base, unseen: unseen || undefined }
}
