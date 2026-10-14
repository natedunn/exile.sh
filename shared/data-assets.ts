import release from "./data-release.json"

export const dataReleaseKey = release.releaseId
export type DataSelection = {
  schemaVersion: number
  releaseId: string
  prefixes: Record<string, string>
  releases: Record<string, string>
}
export const dataSelection: DataSelection = release

export function parseDataSelection(
  value: unknown,
  releaseId: string
): DataSelection {
  if (!value || typeof value !== "object")
    throw new Error("Invalid reference selection")
  const row = value as Partial<DataSelection>
  if (
    row.schemaVersion !== 1 ||
    row.releaseId !== releaseId ||
    !row.prefixes ||
    typeof row.prefixes !== "object" ||
    Array.isArray(row.prefixes) ||
    !row.releases ||
    typeof row.releases !== "object" ||
    Array.isArray(row.releases)
  )
    throw new Error("Invalid reference selection")
  for (const [prefix, target] of Object.entries(row.prefixes)) {
    const match =
      typeof target === "string"
        ? /^\/data-releases\/([a-z0-9][a-z0-9-]{2,79})(\/.*)$/.exec(target)
        : null
    if (
      !/^\/(?:[a-z0-9_.-]+\/)+$/.test(prefix) ||
      prefix.split("/").some((part) => part === "." || part === "..") ||
      match?.[2] !== prefix
    )
      throw new Error("Invalid reference asset prefix")
  }
  if (
    Object.values(row.releases).some(
      (id) => typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(id)
    )
  )
    throw new Error("Invalid reference release ID")
  return row as DataSelection
}

/** Resolve only registered reference assets; application routes stay unchanged. */
export function dataAssetUrl(
  path: string,
  prefixes: Readonly<Record<string, string>> = release.prefixes
): string {
  if (!path.startsWith("/")) return path
  let matched = ""
  for (const prefix in prefixes)
    if (
      Object.hasOwn(prefixes, prefix) &&
      prefix.length > matched.length &&
      path.startsWith(prefix)
    )
      matched = prefix
  return matched ? prefixes[matched] + path.slice(matched.length) : path
}

/** Preserve geometry/stat objects when none of their references change. */
export function resolveDataReferences<T>(
  value: T,
  prefixes: Readonly<Record<string, string>> = release.prefixes
): T {
  if (Object.keys(prefixes).length === 0) return value
  const visit = (entry: unknown): unknown => {
    if (typeof entry === "string") return dataAssetUrl(entry, prefixes)
    if (Array.isArray(entry)) {
      let changed: unknown[] | undefined
      for (let i = 0; i < entry.length; i++) {
        const next = visit(entry[i])
        if (next !== entry[i]) {
          changed ??= entry.slice()
          changed[i] = next
        }
      }
      return changed ?? entry
    }
    if (entry && typeof entry === "object") {
      const original = entry as Record<string, unknown>
      let changed: Record<string, unknown> | undefined
      for (const [key, previous] of Object.entries(original)) {
        const next = visit(previous)
        if (next !== previous) {
          changed ??= { ...original }
          Object.defineProperty(changed, key, {
            value: next,
            enumerable: true,
            writable: true,
            configurable: true,
          })
        }
      }
      return changed ?? entry
    }
    return entry
  }
  return visit(value) as T
}

/** Same response semantics as fetch, with reference URLs resolved inside JSON. */
export async function fetchDataAsset(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(dataAssetUrl(path), init)
  const json = response.json.bind(response)
  response.json = async () => resolveDataReferences(await json())
  return response
}
