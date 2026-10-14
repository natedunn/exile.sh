/** Domain tests read the selected release, matching client/server asset readers. */
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { isAbsolute } from "node:path"
import { dataAssetUrl } from "./data-assets"

const root = new URL("../", import.meta.url)
const publicRoot = new URL("public/", root)
function selectedFile(path: string | URL) {
  const original =
    path instanceof URL
      ? path
      : isAbsolute(path)
        ? pathToFileURL(path)
        : new URL(path, root)
  if (!original.href.startsWith(publicRoot.href)) return original
  const url = dataAssetUrl(
    "/" + fileURLToPath(original).slice(fileURLToPath(publicRoot).length)
  )
  return new URL("public" + url, root)
}
export function readDataFileSync(path: string | URL): Buffer
export function readDataFileSync(
  path: string | URL,
  encoding: BufferEncoding
): string
export function readDataFileSync(
  path: string | URL,
  encoding?: BufferEncoding
): Buffer | string {
  return encoding
    ? readFileSync(selectedFile(path), encoding)
    : readFileSync(selectedFile(path))
}
export function existsDataFileSync(path: string | URL): boolean {
  return existsSync(selectedFile(path))
}
export function readDataJson<T>(path: string): T {
  return JSON.parse(
    readDataFileSync(new URL(path, import.meta.url), "utf8")
  ) as T
}
export function canonicalAssetPath(
  path: string | undefined
): string | undefined {
  return path?.replace(/^\/data-releases\/[a-z0-9-]+\//, "/")
}
