import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { selectedDataPath } from "./data-pipeline-files.mjs"

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const record = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Expected object: ${label}`)
  return value
}

export function diffRecords(before, after) {
  record(before, "baseline records")
  record(after, "candidate records")
  const added = [],
    removed = [],
    changed = []
  for (const id of [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].sort()) {
    if (!Object.hasOwn(before, id)) added.push(id)
    else if (!Object.hasOwn(after, id)) removed.push(id)
    else if (!isDeepStrictEqual(before[id], after[id])) {
      const old = record(before[id], id),
        next = record(after[id], id)
      changed.push({
        id,
        fields: [...new Set([...Object.keys(old), ...Object.keys(next)])]
          .filter((field) => !isDeepStrictEqual(old[field], next[field]))
          .sort(),
      })
    }
  }
  return { added, removed, changed }
}

// Read checked-in references only. Never fetch mutable upstream files or run generators.
export function auditGameData(root) {
  const artifacts = {}
  const read = (path) => {
    const bytes = readFileSync(join(root, selectedDataPath(root, path)))
    artifacts[path] = hash(bytes)
    return JSON.parse(bytes.toString("utf8"))
  }
  const sources = {}
  for (const path of [
    "shared/catalog-source.json",
    "shared/equipment-art-source.json",
    "shared/socket-art-source.json",
    "shared/augment-modifiers-source.json",
    "public/items/v1/source.json",
    "public/gems/v1/source.json",
    "public/gems/effects-v1/source.json",
    "public/augments/v1/source.json",
  ])
    sources[path] = record(read(path), `source manifest: ${path}`)

  const itemSource = sources["public/items/v1/source.json"]
  const itemFile = read("public/items/v1/catalogue.json")
  const pools = read("public/items/v1/modifiers.json")
  const gemFile = read("public/gems/v1/catalogue.json")
  const headers = read("public/gems/v1/headers.json")
  const compatibility = read("public/gems/v1/support-compatibility.json")
  const search = read("public/gems/v1/search-index.json")
  const keywords = read("public/gems/v1/keywords.json")
  const keywordAliases = read("public/gems/v1/keyword-aliases.json")
  const gemAliases = read("shared/gem-name-aliases.json")
  const items = record(itemFile.items, "items"),
    gems = record(gemFile.gems, "gems")
  const mods = record(pools.mods, "mods")
  if (
    !Array.isArray(pools.essences) ||
    !Array.isArray(pools.augments) ||
    !Array.isArray(pools.influences)
  )
    throw new Error("Expected essence, augment and influence arrays")
  const byId = (rows, label) => {
    const result = {}
    for (const row of rows) {
      if (!row.id || Object.hasOwn(result, row.id))
        throw new Error(`Invalid/duplicate ${label} ID`)
      result[row.id] = row
    }
    return result
  }
  const datasets = {
    items,
    modifiers: mods,
    gems,
    gemHeaders: record(headers.gems, "gem headers"),
    skillHeaders: record(headers.skills, "skill headers"),
    keywords: record(keywords.keywords, "keywords"),
    essences: byId(pools.essences, "essence"),
    augments: byId(pools.augments, "augment"),
    augmentSlots: Object.fromEntries(
      Object.entries(record(pools.augmentSlots, "augmentSlots")).map(
        ([id, classes]) => [id, { classes }]
      )
    ),
    influences: byId(
      pools.influences.map((row) => ({ ...row, id: row.tag })),
      "influence"
    ),
  }
  for (const [name, data] of Object.entries({
    supportMatches: compatibility.supports,
    effectSearch: search,
    keywordAliases: keywordAliases.aliases,
    linkedDescriptions: keywordAliases.descriptions,
    gemAliases: gemAliases.aliases,
  }))
    datasets[name] = Object.fromEntries(
      Object.entries(record(data, name)).map(([id, value]) => [id, { value }])
    )
  const expected = new Set(
    Object.values(gems).map((gem) => {
      if (
        typeof gem.skillId !== "string" ||
        !/^[A-Za-z0-9_]+$/.test(gem.skillId)
      )
        throw new Error("Invalid gem skill ID")
      return gem.skillId
    })
  )
  const effects = {},
    partial = []
  for (const file of readdirSync(join(root, selectedDataPath(root, "public/gems/effects-v1"))).sort()) {
    if (!file.endsWith(".json") || file === "source.json") continue
    const id = file.slice(0, -5),
      effect = read(`public/gems/effects-v1/${file}`)
    const sets = record(effect.sets, `effect sets: ${id}`)
    if (!Object.keys(sets).length) throw new Error(`Empty effect sets: ${id}`)
    effects[id] = effect
    const counts = { levels: 0, quality: 0, gemlingQuality: 0 }
    for (const set of Object.values(sets)) {
      record(set.levels, `effect levels: ${id}`)
      for (const group of Object.keys(counts)) {
        for (const entry of Object.values(
          record(set[group] ?? {}, `${id}: ${group}`)
        )) {
          if (!Array.isArray(entry.lines) || typeof entry.partial !== "boolean")
            throw new Error(`Invalid effect entry: ${id}: ${group}`)
          if (entry.partial) counts[group]++
        }
      }
    }
    if (Object.values(counts).some(Boolean)) partial.push({ id, ...counts })
  }
  datasets.effects = effects
  const poe2db = read("scripts/data/poe2db-modifier-pools.json")
  const diagnostics = Object.fromEntries(
    Object.entries(itemSource).filter(([key]) => /diagnostics$/i.test(key))
  )
  const output = {
    schemaVersion: 1,
    patchMatch: "unverified",
    note: "Local inventory and generated-data diff only. Patch evidence and raw-source completeness need manual review; no release is authorized by this report.",
    artifacts,
    artifactFingerprint: hash(JSON.stringify(Object.entries(artifacts).sort())),
    sources,
    coverage: {
      counts: Object.fromEntries(
        Object.entries(datasets).map(([key, rows]) => [
          key,
          Object.keys(rows).length,
        ])
      ),
      itemDiagnostics: diagnostics,
      effectDiagnostics:
        sources["public/gems/effects-v1/source.json"].diagnostics,
      missingEffects: [...expected]
        .filter((id) => !Object.hasOwn(effects, id))
        .sort(),
      orphanEffects: Object.keys(effects)
        .filter((id) => !expected.has(id))
        .sort(),
      partialEffects: partial,
      poe2db: {
        captured: poe2db.captured,
        pages: Object.keys(record(poe2db.pages, "PoE2DB pages")).sort(),
      },
    },
  }
  // Include comparison content outside the JSON report to keep reports manageable.
  return { output, datasets, poe2dbPages: poe2db.pages }
}

export function compareAudits(before, after) {
  const datasets = Object.fromEntries(
    Object.keys(after.datasets).map((key) => [
      key,
      diffRecords(before.datasets[key], after.datasets[key]),
    ])
  )
  const paths = [
    ...new Set([
      ...Object.keys(before.output.artifacts),
      ...Object.keys(after.output.artifacts),
    ]),
  ].sort()
  return {
    changedArtifacts: paths.filter(
      (path) => before.output.artifacts[path] !== after.output.artifacts[path]
    ),
    datasets,
    poe2dbPages: diffRecords(before.poe2dbPages, after.poe2dbPages),
    coverageChanged: !isDeepStrictEqual(
      before.output.coverage,
      after.output.coverage
    ),
    baselineCoverage: before.output.coverage,
  }
}
