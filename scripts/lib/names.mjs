import { createHash } from "node:crypto"

export function sanitizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function stableHash(value, length = 8) {
  return createHash("sha256").update(value).digest("hex").slice(0, length)
}

export function boundedHashedName(
  label,
  hashSource,
  { fallback = "preview", maxLength = 40 } = {}
) {
  const suffix = stableHash(hashSource)
  const prefixLength = maxLength - suffix.length - 1
  if (prefixLength < 1) throw new Error("Name limit is too short for a hash.")
  const prefix = (sanitizeName(label) || fallback)
    .slice(0, prefixLength)
    .replace(/-$/g, "")
  return `${prefix || fallback.slice(0, prefixLength)}-${suffix}`
}
