import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs"
import { resolve, relative, dirname, join, isAbsolute } from "node:path"

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex")
export function fingerprint(value) {
  const canonical = (entry) =>
    Array.isArray(entry)
      ? entry.map(canonical)
      : entry && typeof entry === "object"
        ? Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, canonical(entry[key])])
          )
        : entry
  return sha256(JSON.stringify(canonical(value)) ?? "undefined")
}
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))
export function safePath(root, path) {
  if (
    typeof path !== "string" ||
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").includes("..")
  )
    throw new Error(`Unsafe relative path: ${path}`)
  const target = resolve(root, path)
  if (
    !relative(resolve(root), target) ||
    relative(resolve(root), target).startsWith("..")
  )
    throw new Error(`Path escapes root: ${path}`)
  // A symlinked ancestor must never redirect reads/writes out of a candidate.
  let at = resolve(root)
  for (const part of relative(at, target).split("/")) {
    at = join(at, part)
    if (existsSync(at) && lstatSync(at).isSymbolicLink())
      throw new Error(`Symlink in data path: ${path}`)
  }
  return target
}
export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = path + ".tmp"
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  })
  renameSync(temporary, path)
}
export function filesUnder(root, paths) {
  const result = {}
  const visit = (path) => {
    const full = safePath(root, path)
    if (!existsSync(full)) throw new Error(`Missing required data: ${path}`)
    const stat = lstatSync(full)
    if (stat.isDirectory())
      for (const name of readdirSync(full).sort()) visit(`${path}/${name}`)
    else if (stat.isFile()) result[path] = sha256(readFileSync(full))
    else throw new Error(`Unsupported data file: ${path}`)
  }
  for (const path of [...paths].sort()) visit(path)
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
  )
}
export function verifyFiles(root, files) {
  for (const [path, hash] of Object.entries(files)) {
    if (sha256(readFileSync(safePath(root, path))) !== hash)
      throw new Error(`Artifact changed: ${path}`)
  }
}

export function selectedDataPath(root, path) {
  const registry = join(root, "shared/data-release.json")
  const prefixes = existsSync(registry) ? readJson(registry).prefixes : {}
  if (!path.startsWith("public/")) return path
  const url = "/" + path.slice("public/".length)
  const prefix = Object.keys(prefixes).find((prefix) =>
    (url + "/").startsWith(prefix)
  )
  return prefix ? "public" + prefixes[prefix] + url.slice(prefix.length) : path
}

export function selectedDataFiles(root, paths) {
  const result = {}
  for (const path of paths) {
    const selected = selectedDataPath(root, path)
    for (const [file, hash] of Object.entries(filesUnder(root, [selected])))
      result[path + file.slice(selected.length)] = hash
  }
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
  )
}

export function releaseSummary(record, recordSha256) {
  return {
    schemaVersion: 1,
    releaseId: record.releaseId,
    targetPatch: record.targetPatch,
    features: record.features,
    candidateFingerprint: record.candidateFingerprint,
    reviewFingerprint: record.reviewFingerprint,
    recordPath: `data/releases/${record.releaseId}.json`,
    recordSha256,
  }
}
export function readReleaseRecord(root, id) {
  const summary = readJson(
    safePath(root, `public/data-releases/${id}/release.json`)
  )
  if (summary.recordPath !== `data/releases/${id}.json`)
    throw new Error(`Invalid release record pointer: ${id}`)
  const bytes = readFileSync(safePath(root, summary.recordPath))
  if (sha256(bytes) !== summary.recordSha256)
    throw new Error(`Release evidence changed: ${id}`)
  const record = JSON.parse(bytes.toString("utf8"))
  if (
    fingerprint(summary) !==
    fingerprint(releaseSummary(record, summary.recordSha256))
  )
    throw new Error(`Release summary mismatch: ${id}`)
  return record
}

export const FEATURES = {
  economy: {
    generators: ["update-catalog.py"],
    providers: ["repoe"],
    public: [],
    shared: ["shared/catalog.json", "shared/catalog-source.json"],
  },
  items: {
    generators: ["update-item-registry.py", "snapshot-poe2db.py"],
    providers: ["pob", "repoe", "poe2db", "manual"],
    public: ["items/v1"],
    shared: [],
    checks: ["scripts/data/poe2db-modifier-pools.json"],
    fixtures: [
      "scripts/data/runeforging-recipes.json",
      "scripts/data/unique-runeforging.json",
      "scripts/data/poe2db-accepted-differences.json",
    ],
  },
  gems: {
    generators: [
      "update-gem-art.py",
      "build-gem-headers.py",
      "update-gem-effects.py",
      "update-gem-name-aliases.py",
      "build-gem-compatibility.py",
      "build-gem-search-index.py",
      "update-gem-keywords.py",
    ],
    providers: ["pob", "repoe"],
    public: ["gems/v1", "gems/effects-v1"],
    shared: ["shared/gem-name-aliases.json"],
  },
  augments: {
    generators: ["update-augment-modifiers.py"],
    providers: ["pob"],
    public: ["augments/v1"],
    shared: [
      "shared/augment-modifiers.json",
      "shared/augment-modifiers-source.json",
    ],
  },
  equipment: {
    generators: ["update-equipment-art.py", "update-socket-art.py"],
    providers: ["repoe"],
    public: ["equipment"],
    shared: [
      "shared/equipment-art.json",
      "shared/equipment-art-source.json",
      "shared/socket-art.json",
      "shared/socket-art-source.json",
    ],
  },
  trees: {
    generators: [
      "build-tree-assets.py",
      "update-tree-art.py",
      "update-tree-unseen.py",
      "update-class-art.py",
      "update-ascendancy-backgrounds.py",
      "build-ascendancy-assets.py",
      "build-abyssal-lich.py",
      "build-passive-explorer-assets.py",
      "build-item-node-references.py",
    ],
    providers: ["pob"],
    public: [
      "pob-trees/v4",
      "pob-trees/art-v2",
      "pob-trees/passives-v1",
      "pob-trees/ascendancies-v1",
      "pob-trees/ascendancy-v1",
      "pob-trees/node-reference-v1",
      "class-art",
    ],
    shared: [
      "shared/generated/tree-unseen.json",
      "shared/generated/ascendancy-trees.json",
      "shared/generated/ascendancy-backgrounds.json",
      "shared/class-art.ts",
    ],
    checks: ["shared/fixtures/pob/abyssal-lich-options.json"],
  },
  atlas: {
    generators: ["build-atlas-assets.py"],
    providers: ["repoe", "poe2db"],
    public: ["atlas-trees/v2"],
    shared: [],
    fixtures: [
      "shared/fixtures/atlas/Atlas.json",
      "shared/fixtures/atlas/options.json",
    ],
  },
  genesis: {
    generators: ["build-genesis-assets.py"],
    providers: ["repoe", "poe2db"],
    public: ["genesis-trees/v1"],
    shared: [],
    fixtures: [
      "shared/fixtures/genesis/BrequelTree.json",
      "shared/fixtures/genesis/options.json",
      "shared/fixtures/genesis/stat-translations.json",
    ],
  },
}
export function featurePaths(feature) {
  const entry = FEATURES[feature]
  if (!entry) throw new Error(`Unknown feature: ${feature}`)
  return [
    ...entry.public.map((path) => `public/${path}`),
    ...checkoutPaths(feature),
  ]
}
export function checkoutPaths(feature) {
  const entry = FEATURES[feature]
  return [
    ...new Set([
      ...entry.shared,
      ...(entry.checks ?? []),
      ...(entry.fixtures ?? []),
    ]),
  ]
}
export function validateConfig(config) {
  if (
    config.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{2,79}$/.test(config.releaseId ?? "") ||
    typeof config.targetPatch !== "string" ||
    !config.targetPatch.trim()
  )
    throw new Error("Set schemaVersion, releaseId and targetPatch")
  if (!/^https:\/\//.test(config.officialUrl ?? ""))
    throw new Error("Official patch evidence URL required")
  if (
    !Array.isArray(config.features) ||
    !config.features.length ||
    new Set(config.features).size !== config.features.length
  )
    throw new Error("Select distinct affected features")
  for (const feature of config.features) featurePaths(feature)
  if (!Array.isArray(config.sources) || !config.sources.length)
    throw new Error("Explicit capture sources required")
  const ids = new Set(),
    urls = new Set(),
    targets = new Set()
  for (const source of config.sources) {
    if (
      typeof source.id !== "string" ||
      !source.id ||
      ids.has(source.id) ||
      !source.provider
    )
      throw new Error("Distinct source IDs and providers required")
    ids.add(source.id)
    if (Boolean(source.url) === Boolean(source.local))
      throw new Error(`Choose URL or local file: ${source.id}`)
    if (
      source.url &&
      (!source.url.startsWith("https://") || urls.has(source.url))
    )
      throw new Error(`Invalid/duplicate source URL: ${source.id}`)
    if (source.downloadUrl && !source.downloadUrl.startsWith("https://"))
      throw new Error(`Invalid pinned download URL: ${source.id}`)
    if (source.url) urls.add(source.url)
    if (
      source.artwork &&
      !["equipment-bases", "equipment-uniques", "gem-icons"].includes(
        source.artwork
      )
    )
      throw new Error(`Unknown artwork discovery mode: ${source.id}`)
    if (source.targetPath) {
      const allowed = source.features?.some((feature) =>
        FEATURES[feature]?.fixtures?.includes(source.targetPath)
      )
      if (!allowed || targets.has(source.targetPath))
        throw new Error(
          `Invalid/duplicate frozen fixture destination: ${source.targetPath}`
        )
      targets.add(source.targetPath)
    }
    if (source.sha256 && !/^[a-f0-9]{64}$/.test(source.sha256))
      throw new Error(`Invalid source hash: ${source.id}`)
    if (
      !Array.isArray(source.features) ||
      !source.features.length ||
      source.features.some((f) => !config.features.includes(f))
    )
      throw new Error(`Source needs selected feature assignments: ${source.id}`)
  }
  if (
    config.features.some((feature) =>
      FEATURES[feature].providers.includes("pob")
    ) &&
    !/^[a-f0-9]{40}$/.test(config.pobRevision ?? "")
  )
    throw new Error("Full pinned PoB commit required")
  if (
    config.features.includes("trees") &&
    (!Array.isArray(config.treeVersions) ||
      !config.treeVersions.length ||
      config.treeVersions.some((v) => !/^\d+_\d+$/.test(v)))
  )
    throw new Error("Explicit treeVersions required")
  if (
    config.treeVersions &&
    new Set(config.treeVersions).size !== config.treeVersions.length
  )
    throw new Error("Distinct treeVersions required")
  return config
}
