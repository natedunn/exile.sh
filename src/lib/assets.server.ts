import { env } from "cloudflare:workers"
import { dataSelection } from "../../shared/data-assets"
import { createReferenceAssetReader } from "./reference-asset-reader"
import type { ItemCatalogue } from "../../shared/item-registry"
import type { GemCatalogue, GemHeaders, GemEffects } from "../../shared/gems"
import type { GemCompatibility } from "../../shared/gem-compatibility"

// The binding ignores the host in production; Vite development accepts localhost.
const reader = createReferenceAssetReader(
  (path) => env.ASSETS.fetch(new URL(path, "http://localhost")),
  dataSelection
)
export const assetBytes = reader.bytes
export const gemCatalogue = (releaseId?: string) =>
  reader.json<GemCatalogue>("/gems/v1/catalogue.json", releaseId)
export const gemHeaders = (releaseId?: string) =>
  reader.json<GemHeaders>("/gems/v1/headers.json", releaseId)
export const gemCompatibility = (releaseId?: string) =>
  reader.json<GemCompatibility>(
    "/gems/v1/support-compatibility.json",
    releaseId
  )
export const gemEffects = (skillId: string, releaseId?: string) =>
  reader.json<GemEffects | null>(
    `/gems/effects-v1/${encodeURIComponent(skillId)}.json`,
    releaseId,
    true
  )
export const itemCatalogue = (releaseId?: string) =>
  reader.json<ItemCatalogue>("/items/v1/catalogue.json", releaseId)
