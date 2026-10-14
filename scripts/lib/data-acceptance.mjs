import {
  existsSync,
  readFileSync,
  cpSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { join, dirname, resolve } from "node:path"
import {
  FEATURES,
  checkoutPaths,
  fingerprint,
  readJson,
  safePath,
  sha256,
  verifyFiles,
  writeJson,
  releaseSummary,
  readReleaseRecord,
} from "./data-pipeline-files.mjs"
import {
  projectRoot,
  verifyCandidate,
  candidateTestCommand,
} from "./data-pipeline.mjs"

export function sourceGroups(manifest) {
  const groups = {}
  for (const source of Object.values(manifest.sourceAccess)) {
    const key = `${source.feature}/${source.provider}`
    ;(groups[key] ??= []).push([source.id, source.sha256])
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, entries]) => [
      key,
      fingerprint(entries.sort(([a], [b]) => a.localeCompare(b))),
    ])
  )
}
const text = (value) => typeof value === "string" && value.trim().length >= 10
function select(value, path) {
  for (const key of path) {
    if (value == null || !Object.hasOwn(value, key)) return { present: false }
    value = value[key]
  }
  return { present: true, value }
}
export function evaluateAcceptance(manifest, review, { root, tests } = {}) {
  const blockers = [],
    groups = sourceGroups(manifest)
  const block = (reason) => blockers.push(reason)
  if (
    review.schemaVersion !== 1 ||
    review.candidateFingerprint !== manifest.fingerprint ||
    review.targetPatch !== manifest.config.targetPatch
  )
    block("Review does not match this exact candidate and target patch")
  if (
    !review.scope?.complete ||
    review.scope.officialUrl !== manifest.config.officialUrl ||
    !review.scope.reviewer ||
    !text(review.scope.reason)
  )
    block("Official patch scope has not been completely reviewed")
  for (const feature of manifest.config.features) {
    for (const provider of FEATURES[feature].providers) {
      const key = `${feature}/${provider}`,
        hash = groups[key]
      if (!hash) {
        block(`${key}: required captured inputs absent`)
        continue
      }
      const matching = (review.sourceReviews ?? []).filter(
        (row) => row.feature === feature && row.provider === provider
      )
      const row = matching[0]
      if (
        matching.length !== 1 ||
        row.hash !== hash ||
        row.targetPatch !== manifest.config.targetPatch ||
        !["verified", "not-affected"].includes(row.status) ||
        !row.reviewer ||
        !text(row.evidence)
      )
        block(`${key}: waiting, disputed, stale or missing patch evidence`)
    }
    const mechanic = (review.mechanics ?? []).filter(
      (row) => row.feature === feature
    )
    if (
      mechanic.length !== 1 ||
      mechanic[0].status !== "verified" ||
      !["unchanged", "changed", "new"].includes(mechanic[0].kind) ||
      !mechanic[0].agent ||
      !text(mechanic[0].evidence)
    )
      block(`${feature}: mechanics review missing`)
    else if (mechanic[0].kind !== "unchanged" && !mechanic[0].developer)
      block(`${feature}: changed/new mechanics need developer and agent review`)
  }
  const resolved = new Map()
  for (const row of review.issueReviews ?? []) {
    if (
      !Array.isArray(row.ids) ||
      !row.ids.length ||
      !text(row.reason) ||
      !text(row.evidence) ||
      !row.reviewer ||
      !["verified", "not-applicable", "unsupported"].includes(
        row.disposition
      ) ||
      (row.disposition === "unsupported" && !row.developer)
    ) {
      block("Invalid issue review; use explicit IDs, evidence and a reviewer")
      continue
    }
    for (const id of row.ids) {
      if (resolved.has(id)) block(`Duplicate issue review: ${id}`)
      resolved.set(id, row)
    }
  }
  const required = new Set(manifest.issues.map((issue) => issue.id))
  for (const id of required)
    if (!resolved.has(id)) block(`Unreviewed change/omission: ${id}`)
  for (const id of resolved.keys())
    if (!required.has(id)) block(`Obsolete issue review: ${id}`)
  if (!Array.isArray(review.ledger) || !review.ledger.length)
    block("Patch change ledger is empty")
  const ledgerIds = new Set()
  for (const check of review.ledger ?? []) {
    if (!check.id || ledgerIds.has(check.id)) {
      block("Distinct patch ledger IDs required")
      continue
    }
    ledgerIds.add(check.id)
    if (
      !manifest.config.features.includes(check.feature) ||
      !/^https:\/\//.test(check.officialUrl ?? "") ||
      !text(check.description) ||
      !text(check.evidence) ||
      !check.reviewer
    ) {
      block(`Ledger evidence incomplete: ${check.id}`)
      continue
    }
    if (check.status === "out-of-scope") {
      if (!check.developer || !text(check.reason))
        block(`Out-of-scope patch entry needs developer review: ${check.id}`)
      continue
    }
    if (check.status !== "verified") {
      block(`Patch entry unresolved: ${check.id}`)
      continue
    }
    if (
      !Object.hasOwn(manifest.outputFiles, check.artifact) ||
      !Array.isArray(check.path) ||
      !check.path.length
    ) {
      block(`Patch entry must select a generated artifact field: ${check.id}`)
      continue
    }
    try {
      const selected = select(
        readJson(safePath(root, check.artifact)),
        check.path
      )
      const equal = fingerprint(selected.value) === fingerprint(check.expected)
      const matches =
        check.operator === "equal"
          ? selected.present && equal
          : check.operator === "contains"
            ? selected.present &&
              (Array.isArray(selected.value)
                ? selected.value.some(
                    (value) =>
                      fingerprint(value) === fingerprint(check.expected)
                  )
                : typeof selected.value === "string" &&
                  typeof check.expected === "string" &&
                  selected.value.includes(check.expected))
            : check.operator === "absent"
              ? !selected.present
              : false
      if (!matches) block(`Expected patch value/effect missing: ${check.id}`)
    } catch (error) {
      block(`Patch check failed: ${check.id}: ${error.message}`)
    }
  }
  if (
    !tests?.passed ||
    tests.candidateFingerprint !== manifest.fingerprint ||
    tests.command !== candidateTestCommand
  )
    block("Passing domain-test receipt for this exact candidate required")
  return {
    schemaVersion: 1,
    candidateFingerprint: manifest.fingerprint,
    reviewFingerprint: fingerprint(review),
    ready: blockers.length === 0,
    blockers,
    sourceGroups: groups,
  }
}
export function checkCandidate(root, reviewPath = join(root, "review.json")) {
  const manifest = verifyCandidate(root),
    review = readJson(reviewPath)
  const tests = existsSync(join(root, "tests.json"))
    ? readJson(join(root, "tests.json"))
    : null
  return evaluateAcceptance(manifest, review, { root, tests })
}

function publicationLock(checkout, action) {
  const lock = join(checkout, ".data-publication.lock")
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid }), { flag: "wx" })
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another publication/rollback may be active; inspect .data-publication.lock before retrying"
      )
    throw error
  }
  try {
    return action()
  } finally {
    rmSync(lock)
  }
}
export function preparePublication(root, options = {}) {
  const checkout = resolve(options.checkout ?? projectRoot)
  return publicationLock(checkout, () =>
    prepareUnlocked(root, { ...options, checkout })
  )
}
function prepareUnlocked(
  root,
  { checkout = projectRoot, reviewPath = join(root, "review.json") } = {}
) {
  const manifest = verifyCandidate(root),
    review = readJson(reviewPath)
  const tests = existsSync(join(root, "tests.json"))
    ? readJson(join(root, "tests.json"))
    : null
  const result = evaluateAcceptance(manifest, review, { root, tests })
  if (!result.ready)
    throw new Error(`Patch acceptance blocked:\n${result.blockers.join("\n")}`)
  if (fingerprint(readJson(reviewPath)) !== result.reviewFingerprint)
    throw new Error("Review changed during preparation; check the new evidence")
  checkout = resolve(checkout)
  verifyFiles(checkout, manifest.toolchain)
  verifyFiles(checkout, { "package.json": manifest.testInputs["package.json"] })
  if (
    fingerprint(readJson(join(checkout, "shared/data-release.json"))) !==
    fingerprint(manifest.baselineRegistry)
  )
    throw new Error(
      "Baseline selection changed; regenerate against the selected releases"
    )
  // Publication preparation is reversible checkout work. It does not deploy.
  // Protect the baseline and refuse to overwrite any shared changes made since generation.
  verifyFiles(
    checkout,
    Object.fromEntries(
      Object.entries(manifest.baselineFiles).filter(
        ([path]) => !path.startsWith("public/")
      )
    )
  )
  const releaseId = manifest.config.releaseId,
    target = join(checkout, "public/data-releases", releaseId)
  const release = {
    schemaVersion: 1,
    releaseId,
    targetPatch: manifest.config.targetPatch,
    candidateFingerprint: manifest.fingerprint,
    reviewFingerprint: result.reviewFingerprint,
    officialUrl: manifest.config.officialUrl,
    features: manifest.config.features,
    files: manifest.publication.publicFiles,
    sharedFiles: manifest.publication.sharedFiles,
    previousSharedFiles: Object.fromEntries(
      Object.entries(manifest.baselineFiles).filter(([path]) =>
        Object.hasOwn(manifest.publication.sharedFiles, path)
      )
    ),
    prefixes: manifest.publication.prefixes,
    selection: manifest.publication.selection,
    sourceGroups: result.sourceGroups,
    sourceRecords: manifest.sourceRecords,
    sources: manifest.captureSources.map(
      ({
        id,
        provider,
        url,
        downloadUrl,
        sha256,
        capturedAt,
        status,
        features,
        targetPath,
        provenance,
      }) => ({
        id,
        provider,
        url,
        downloadUrl,
        sha256,
        capturedAt,
        status,
        features,
        targetPath,
        provenance,
      })
    ),
    review,
    tests: readJson(join(root, "tests.json")),
    runtime: manifest.runtime,
    generatorHashes: Object.fromEntries(
      Object.entries(manifest.toolchain).filter(([path]) =>
        path.endsWith(".py")
      )
    ),
  }
  const recordPath = join(checkout, "data/releases", releaseId + ".json")
  const recordBytes = Buffer.from(JSON.stringify(release, null, 2) + "\n")
  const summary = releaseSummary(release, sha256(recordBytes))
  if (existsSync(recordPath)) {
    if (sha256(readFileSync(recordPath)) !== summary.recordSha256)
      throw new Error(
        "Release evidence ID already exists with different content"
      )
  } else writeJson(recordPath, release)
  if (existsSync(target)) {
    const existing = readReleaseRecord(checkout, releaseId)
    if (fingerprint(existing) !== fingerprint(release))
      throw new Error(
        "Published release ID already exists with different content; choose a new ID"
      )
    verifyFiles(target, release.files)
  } else {
    mkdirSync(dirname(target), { recursive: true })
    const temporary = target + ".staging"
    if (existsSync(temporary))
      throw new Error("Publication staging already exists")
    mkdirSync(temporary)
    cpSync(join(root, ".release-bundle"), temporary, { recursive: true })
    writeJson(join(temporary, "release.json"), summary)
    verifyFiles(temporary, release.files)
    renameSync(temporary, target)
  }
  const registryPath = join(checkout, "shared/data-release.json")
  const registry = release.selection
  // Prepare all shared files first. The final registry switch is written last.
  const prepared = []
  try {
    for (const [path, hash] of Object.entries(release.sharedFiles)) {
      const targetFile = safePath(checkout, path),
        stage = targetFile + ".data-staging"
      if (existsSync(stage))
        throw new Error(`Shared publication staging exists: ${path}`)
      mkdirSync(dirname(stage), { recursive: true })
      cpSync(safePath(root, `.release-shared/${path}`), stage)
      if (sha256(readFileSync(stage)) !== hash)
        throw new Error(`Publication hash mismatch: ${path}`)
      prepared.push([stage, targetFile])
    }
    for (const [stage, targetFile] of prepared) renameSync(stage, targetFile)
    writeJson(registryPath, registry)
  } finally {
    for (const [stage] of prepared) rmSync(stage, { force: true })
  }
  return release
}

export function rollbackSelection(releaseId, checkout = projectRoot) {
  return publicationLock(checkout, () => rollbackUnlocked(releaseId, checkout))
}
function rollbackUnlocked(releaseId, checkout) {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(releaseId ?? ""))
    throw new Error("Valid release ID required")
  const registryPath = join(checkout, "shared/data-release.json"),
    current = readJson(registryPath)
  if (current.releaseId !== releaseId)
    throw new Error(
      "Only the most recent selection can be rolled back; preserve later feature updates"
    )
  verifySelectedRelease(checkout)
  const root = join(checkout, "public/data-releases", releaseId),
    release = readReleaseRecord(checkout, releaseId)
  const previous = readJson(join(root, "_previous/selection.json"))
  verifyFiles(join(root, "_previous"), release.previousSharedFiles)
  for (const path of Object.keys(release.previousSharedFiles)) {
    const target = safePath(checkout, path)
    cpSync(safePath(join(root, "_previous"), path), target + ".data-rollback")
    renameSync(target + ".data-rollback", target)
  }
  writeJson(registryPath, previous)
  verifySelectedRelease(checkout)
  return { restored: previous.releaseId, retainedAssets: releaseId }
}

export function verifySelectedRelease(checkout = projectRoot) {
  const registry = readJson(join(checkout, "shared/data-release.json"))
  if (registry.schemaVersion !== 1) throw new Error("Unsupported data registry")
  const selected = new Set(Object.values(registry.releases))
  if (registry.releaseId === "legacy") {
    if (selected.size || Object.keys(registry.prefixes).length)
      throw new Error("Legacy selection must be empty")
  } else {
    if (!selected.has(registry.releaseId))
      throw new Error("Current release is absent from selection")
    const current = readReleaseRecord(checkout, registry.releaseId)
    if (fingerprint(current.selection) !== fingerprint(registry))
      throw new Error("Selected registry differs from archived selection")
  }
  for (const id of selected) {
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id))
      throw new Error("Invalid selected release ID")
    const root = join(checkout, "public/data-releases", id)
    const release = readReleaseRecord(checkout, id)
    if (
      release.releaseId !== id ||
      release.schemaVersion !== 1 ||
      !release.candidateFingerprint ||
      !release.reviewFingerprint
    )
      throw new Error(`Incomplete selected release: ${id}`)
    if (
      fingerprint(release.review) !== release.reviewFingerprint ||
      release.review.candidateFingerprint !== release.candidateFingerprint ||
      release.tests?.candidateFingerprint !== release.candidateFingerprint ||
      !release.tests.passed
    )
      throw new Error(`Inconsistent release evidence: ${id}`)
    verifyFiles(root, release.files)
    for (const [feature, chosen] of Object.entries(registry.releases)) {
      if (chosen !== id) continue
      if (!release.features.includes(feature))
        throw new Error(`Feature absent from selected release: ${feature}`)
      for (const prefix of FEATURES[feature].public.map(
        (path) => `/${path}/`
      )) {
        if (registry.prefixes[prefix] !== release.prefixes[prefix])
          throw new Error(`Selected asset prefix mismatch: ${prefix}`)
      }
      verifyFiles(
        checkout,
        Object.fromEntries(
          Object.entries(release.sharedFiles).filter(([path]) =>
            checkoutPaths(feature).includes(path)
          )
        )
      )
    }
  }
  for (const [prefix, target] of Object.entries(registry.prefixes)) {
    const owner = Object.entries(FEATURES).find(([, feature]) =>
      feature.public.some((path) => `/${path}/` === prefix)
    )
    if (
      !owner ||
      !registry.releases[owner[0]] ||
      target !== `/data-releases/${registry.releases[owner[0]]}${prefix}`
    )
      throw new Error(`Unowned or inconsistent asset prefix: ${prefix}`)
  }
  return { ready: true, releases: [...selected] }
}
