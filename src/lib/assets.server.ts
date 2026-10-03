import { env } from "cloudflare:workers"
import type { ItemCatalogue } from "../../shared/item-registry"
import type { GemCatalogue, GemHeaders, GemEffects } from "../../shared/gems"
import type { GemCompatibility } from "../../shared/gem-compatibility"

/* Reads the Worker's own static files through the ASSETS binding. Results
 * are kept for the life of the isolate: these files only change on deploy. */

// The binding ignores the host in production; in development it forwards
// to Vite, which only accepts known hosts such as localhost.
const origin = "http://localhost"
const cached = new Map<string, Promise<unknown>>()

function load<T>(
  path: string,
  read: (response: Response) => Promise<T>,
  allowMissing = false
) {
  let entry = cached.get(path) as Promise<T> | undefined
  if (!entry) {
    entry = env.ASSETS.fetch(new URL(path, origin)).then((response) => {
      if (!response.ok && !(allowMissing && response.status === 404))
        throw new Error(`Asset ${path}: ${response.status}`)
      return read(response)
    })
    // A failed read is retried on the next request instead of cached.
    entry.catch(() => cached.delete(path))
    cached.set(path, entry)
  }
  return entry
}

export const assetBytes = (path: string) =>
  load(path, (response) => response.arrayBuffer())

export const gemCatalogue = () =>
  load(
    "/gems/v1/catalogue.json",
    (response) => response.json() as Promise<GemCatalogue>
  )

export const gemHeaders = () =>
  load(
    "/gems/v1/headers.json",
    (response) => response.json() as Promise<GemHeaders>
  )

export const gemCompatibility = () =>
  load(
    "/gems/v1/support-compatibility.json",
    (response) => response.json() as Promise<GemCompatibility>
  )

export const gemEffects = (skillId: string) =>
  load(
    `/gems/effects-v1/${encodeURIComponent(skillId)}.json`,
    (response) =>
      response.status === 404
        ? Promise.resolve(null)
        : (response.json() as Promise<GemEffects>),
    true
  )

export const itemCatalogue = () =>
  load(
    "/items/v1/catalogue.json",
    (response) => response.json() as Promise<ItemCatalogue>
  )
