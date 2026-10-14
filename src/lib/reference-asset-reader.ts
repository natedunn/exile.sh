import {
  dataAssetUrl,
  parseDataSelection,
  resolveDataReferences,
} from "../../shared/data-assets"
import type { DataSelection } from "../../shared/data-assets"

/** Bind old client requests to their complete retained selection, including links
 * inside JSON. A missing old selection is an error, never a current-data fallback. */
export function createReferenceAssetReader(
  fetcher: (path: string) => Promise<Response>,
  current: DataSelection
) {
  const selections = new Map<string, Promise<DataSelection>>()
  const assets = new Map<string, Promise<unknown>>()
  const legacy: DataSelection = {
    schemaVersion: 1,
    releaseId: "legacy",
    prefixes: {},
    releases: {},
  }
  const selection = (id = current.releaseId): Promise<DataSelection> => {
    if (id === current.releaseId) return Promise.resolve(current)
    if (id === "legacy") return Promise.resolve(legacy)
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id))
      return Promise.reject(new Error("Invalid reference release"))
    let pending = selections.get(id)
    if (!pending) {
      pending = fetcher(`/data-releases/${id}/selection.json`).then(
        async (response) => {
          if (!response.ok)
            throw new Error(
              `Reference snapshot unavailable: ${id}; reload the page`
            )
          return parseDataSelection(await response.json(), id)
        }
      )
      pending.catch(() => selections.delete(id))
      if (selections.size >= 32)
        selections.delete(selections.keys().next().value!)
      selections.set(id, pending)
    }
    return pending
  }
  async function load<T>(
    path: string,
    selected: DataSelection,
    read: (response: Response) => Promise<T>,
    allowMissing = false,
    kind = "json"
  ): Promise<T> {
    const resolved = dataAssetUrl(path, selected.prefixes),
      key = `${selected.releaseId}:${kind}:${allowMissing}:${resolved}`
    let entry = assets.get(key) as Promise<T> | undefined
    if (!entry) {
      entry = fetcher(resolved).then((response) => {
        if (!response.ok && !(allowMissing && response.status === 404))
          throw new Error(`Asset ${resolved}: ${response.status}`)
        return read(response)
      })
      entry.catch(() => assets.delete(key))
      assets.set(key, entry)
    }
    return entry
  }
  return {
    async json<T>(
      path: string,
      releaseId?: string,
      allowMissing = false
    ): Promise<T> {
      const selected = await selection(releaseId)
      return load(
        path,
        selected,
        async (response) =>
          response.status === 404
            ? (null as T)
            : (resolveDataReferences(
                await response.json(),
                selected.prefixes
              ) as T),
        allowMissing
      )
    },
    bytes: (path: string) =>
      load(path, current, (response) => response.arrayBuffer(), false, "bytes"),
  }
}
