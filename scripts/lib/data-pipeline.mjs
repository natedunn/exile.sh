import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  renameSync,
} from "node:fs"
import { join, resolve, dirname } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import {
  FEATURES,
  featurePaths,
  checkoutPaths,
  filesUnder,
  fingerprint,
  readJson,
  safePath,
  sha256,
  validateConfig,
  verifyFiles,
  writeJson,
  selectedDataPath,
  selectedDataFiles,
  readReleaseRecord,
} from "./data-pipeline-files.mjs"
import { auditGameData, compareAudits } from "./game-data-audit.mjs"

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url))
export const candidateTestCommand = "vitest run shared --maxWorkers=2"
function newDirectory(path) {
  if (existsSync(path))
    throw new Error(`Destination already exists; use a new directory: ${path}`)
  mkdirSync(dirname(path), { recursive: true })
  mkdirSync(path)
}
export function toolchain(root) {
  const all = filesUnder(root, ["scripts", "src", "shared"])
  return Object.fromEntries(
    Object.entries(all).filter(
      ([path]) =>
        /\.(py|mjs|ts|tsx)$/.test(path) && path !== "shared/class-art.ts"
    )
  )
}
export async function captureSources(
  config,
  out,
  { base = projectRoot, fetcher = fetch } = {}
) {
  validateConfig(config)
  out = resolve(out)
  newDirectory(out)
  const rows = [],
    pending = [...config.sources],
    seen = new Set()
  for (const source of pending) {
    const identity = source.url ?? `local:${source.targetPath ?? source.id}`
    if (seen.has(identity)) {
      const existing = rows.find((row) => row.url === identity)
      existing.features = [
        ...new Set([...existing.features, ...source.features]),
      ].sort()
      continue
    }
    seen.add(identity)
    let bytes,
      status = 200
    if (source.local) bytes = readFileSync(resolve(base, source.local))
    else {
      if (source.provider === "poe2db" && fetcher === fetch)
        await new Promise((done) => setTimeout(done, 500))
      const response = await fetcher(source.downloadUrl ?? source.url, {
        signal: AbortSignal.timeout(60_000),
        headers: { "User-Agent": "exile.sh data capture (hello@natedunn.net)" },
      })
      status = response.status
      if (
        !response.ok &&
        !(source.allowMissing === true && response.status === 404)
      )
        throw new Error(`Source ${source.id}: HTTP ${response.status}`)
      const chunks = [],
        reader = response.body.getReader()
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > 128 * 1024 * 1024) {
          await reader.cancel()
          throw new Error(`Source too large: ${source.id}`)
        }
        chunks.push(value)
      }
      bytes = Buffer.concat(chunks)
    }
    const digest = sha256(bytes)
    if (source.sha256 && digest !== source.sha256)
      throw new Error(`Source changed: ${source.id}`)
    const file = `blobs/${digest}`
    mkdirSync(join(out, "blobs"), { recursive: true })
    if (!existsSync(join(out, file)))
      writeFileSync(join(out, file), bytes, { flag: "wx" })
    rows.push({
      ...source,
      url: identity,
      status,
      file,
      sha256: digest,
      capturedAt: new Date().toISOString(),
    })
    if (source.artwork) {
      const data = JSON.parse(bytes.toString("utf8"))
      const classes = new Set([
        "SoulCore",
        ...[
          ...readFileSync(
            join(projectRoot, "scripts/update-equipment-art.py"),
            "utf8"
          )
            .match(/CLASSES = \{([^}]+)\}/)[1]
            .matchAll(/'([^']+)'/g),
        ].map((match) => match[1]),
      ])
      const quote = (path) =>
        path
          .split("/")
          .map((part) =>
            encodeURIComponent(part).replace(
              /[!'()*]/g,
              (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase()
            )
          )
          .join("/")
      for (const entry of Object.values(data)) {
        if (
          source.artwork === "equipment-bases" &&
          (entry.release_state !== "released" || !classes.has(entry.item_class))
        )
          continue
        if (entry.is_alternate_art) continue
        const path =
          source.artwork === "gem-icons"
            ? entry.icon_dds_file
            : entry.visual_identity?.dds_file
        if (!path?.startsWith("Art/") || !path.endsWith(".dds")) continue
        const url =
          "https://repoe-fork.github.io/poe2/" +
          quote(path.replace(/\.dds$/, ".webp"))
        pending.push({
          id: "art-" + sha256(url).slice(0, 16),
          url,
          provider: "repoe",
          features: source.features,
          allowMissing: true,
        })
      }
    }
    if (source.discover) {
      const listing = JSON.parse(bytes.toString("utf8"))
      if (!Array.isArray(listing) || !listing.length)
        throw new Error(`Empty/invalid source directory: ${source.id}`)
      for (const entry of listing) {
        if (entry.type === "file" && /\.(lua|zst)$/.test(entry.name)) {
          if (!entry.download_url?.includes(`/${config.pobRevision}/`))
            throw new Error(`Unpinned directory member: ${entry.name}`)
          pending.push({
            id: `${source.id}/${entry.name}`,
            provider: source.provider,
            url: entry.download_url,
            features: source.features,
          })
        }
      }
    }
  }
  // Hashes, not fetch times, establish capture identity. Readiness is a later review.
  const result = { schemaVersion: 1, config, sources: rows }
  result.fingerprint = fingerprint({
    config,
    sources: rows.map(({ capturedAt, ...row }) => row),
  })
  writeJson(join(out, "capture.json"), result)
  return result
}
export function verifyCapture(root) {
  const capture = readJson(join(root, "capture.json"))
  validateConfig(capture.config)
  const expected = fingerprint({
    config: capture.config,
    sources: capture.sources.map(({ capturedAt, ...row }) => row),
  })
  if (capture.fingerprint !== expected)
    throw new Error("Capture manifest changed")
  for (const source of capture.sources)
    verifyFiles(root, { [source.file]: source.sha256 })
  return capture
}

function allAccounting(root) {
  const directory = join(root, ".data-accounting")
  if (!existsSync(directory)) return {}
  const result = {}
  for (const file of readdirSync(directory).sort()) {
    const ledger = readJson(join(directory, file))
    if (!ledger.records || ledger.schemaVersion !== 1)
      throw new Error(`Invalid accounting: ${file}`)
    for (const [id, entry] of Object.entries(ledger.records))
      result[`${ledger.generator}/${id}`] = entry
  }
  return result
}
function materializeBundle(root, manifest) {
  const bundle = join(root, ".release-bundle")
  mkdirSync(bundle)
  const prefixes = {}
  const shared = {}
  for (const feature of manifest.config.features) {
    for (const path of FEATURES[feature].public) {
      const prefix = `/${path}/`
      prefixes[prefix] = `/data-releases/${manifest.config.releaseId}/${path}/`
      cpSync(join(root, "public", path), join(bundle, path), {
        recursive: true,
      })
    }
  }
  const rewrite = (text) => {
    return text.replace(/"(?:[^"\\]|\\.)*"/g, (token, offset) => {
      if (
        text
          .slice(offset + token.length)
          .trimStart()
          .startsWith(":")
      )
        return token
      const value = JSON.parse(token)
      const prefix = Object.keys(prefixes).find((prefix) =>
        value.startsWith(prefix)
      )
      return prefix
        ? JSON.stringify(prefixes[prefix] + value.slice(prefix.length))
        : token
    })
  }
  // Shared generated tables ship in the JS deployment; old JS retains its old URLs.
  for (const feature of manifest.config.features)
    for (const path of checkoutPaths(feature)) {
      const original = readFileSync(join(root, path), "utf8")
      const bytes = Buffer.from(
        FEATURES[feature].shared.includes(path) ? rewrite(original) : original
      )
      const target = safePath(root, `.release-shared/${path}`)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, bytes)
      shared[path] = sha256(bytes)
      const archived = join(bundle, "_generated", path)
      mkdirSync(dirname(archived), { recursive: true })
      writeFileSync(archived, bytes)
      const previous = join(bundle, "_previous", path)
      mkdirSync(dirname(previous), { recursive: true })
      cpSync(join(root, ".baseline-shared", path), previous)
    }
  writeJson(join(bundle, "_previous/selection.json"), manifest.baselineRegistry)
  const selection = {
    schemaVersion: 1,
    releaseId: manifest.config.releaseId,
    prefixes: { ...manifest.baselineRegistry.prefixes, ...prefixes },
    releases: { ...manifest.baselineRegistry.releases },
  }
  for (const feature of manifest.config.features)
    selection.releases[feature] = manifest.config.releaseId
  writeJson(join(bundle, "selection.json"), selection)
  const checkReference = (value) => {
    if (typeof value === "string") {
      const prefix = Object.keys(prefixes).find((prefix) =>
        value.startsWith(prefix)
      )
      if (
        prefix &&
        !existsSync(safePath(bundle, value.slice(1).split(/[?#]/)[0]))
      )
        throw new Error(`Missing bundled reference: ${value}`)
      const own = `/data-releases/${manifest.config.releaseId}/`
      if (
        value.startsWith(own) &&
        !existsSync(safePath(bundle, value.slice(own.length).split(/[?#]/)[0]))
      )
        throw new Error(`Missing prepared reference: ${value}`)
      if (
        value.startsWith("/data-releases/") &&
        !value.startsWith(own) &&
        !existsSync(safePath(root, "public" + value.split(/[?#]/)[0]))
      )
        throw new Error(`Missing retained reference: ${value}`)
    } else if (Array.isArray(value)) value.forEach(checkReference)
    else if (value && typeof value === "object")
      Object.values(value).forEach(checkReference)
  }
  for (const path of Object.keys(filesUnder(root, [".release-bundle"])).filter(
    (path) => path.endsWith(".json") && !path.includes("/_previous/")
  ))
    checkReference(readJson(join(root, path)))
  for (const path of Object.keys(shared).filter((path) => path.endsWith(".ts")))
    for (const match of readFileSync(
      join(root, ".release-shared", path),
      "utf8"
    ).matchAll(/"(\/[^"\n]+)"/g))
      checkReference(match[1])
  const publicFiles = Object.keys(filesUnder(root, [".release-bundle"]))
  const publicHashes = Object.fromEntries(
    publicFiles.map((path) => [
      path.slice(".release-bundle/".length),
      sha256(readFileSync(join(root, path))),
    ])
  )
  return { prefixes, selection, publicFiles: publicHashes, sharedFiles: shared }
}

export function generateCandidate(
  captureRoot,
  out,
  { baseline = projectRoot, python = "python3", run = spawnSync } = {}
) {
  captureRoot = resolve(captureRoot)
  out = resolve(out)
  baseline = resolve(baseline)
  const capture = verifyCapture(captureRoot),
    config = capture.config
  const environment = spawnSync(
    python,
    [
      "-c",
      "import sys,json,importlib.metadata as m; packages={};\nfor name in ['Pillow','zstandard','lupa']:\n try: packages[name]=m.version(name)\n except m.PackageNotFoundError: packages[name]=None\nprint(json.dumps({'python':sys.version,'packages':packages}))",
    ],
    { encoding: "utf8" }
  )
  if (environment.error || environment.status !== 0)
    throw new Error(
      `Python environment unavailable: ${environment.error?.message ?? environment.stderr}`
    )
  const runtime = JSON.parse(environment.stdout)
  newDirectory(out)
  const paths = config.features.flatMap(featurePaths)
  const baselineFiles = selectedDataFiles(baseline, paths)
  const tools = toolchain(projectRoot)
  for (const path of ["public", "shared", "src", "scripts/data"])
    cpSync(join(baseline, path), join(out, path), { recursive: true })
  const registry = readJson(join(baseline, "shared/data-release.json"))
  for (const feature of config.features)
    for (const path of checkoutPaths(feature)) {
      mkdirSync(dirname(join(out, ".baseline-shared", path)), {
        recursive: true,
      })
      cpSync(join(baseline, path), join(out, ".baseline-shared", path))
    }
  for (const [prefix, target] of Object.entries(registry.prefixes))
    cpSync(join(baseline, "public", target), join(out, "public", prefix), {
      recursive: true,
    })
  // Staged tests use canonical paths against the candidate, without selecting
  // a previously published namespace inherited from the baseline.
  writeJson(join(out, "shared/data-release.json"), {
    schemaVersion: 1,
    releaseId: config.releaseId,
    prefixes: {},
    releases: {},
  })
  // Tests always use the implementing checkout's code, not old baseline code.
  for (const path of ["src", "shared"]) {
    const code = filesUnder(projectRoot, [path])
    for (const name of Object.keys(code).filter(
      (name) => /\.(ts|tsx)$/.test(name) && name !== "shared/class-art.ts"
    )) {
      mkdirSync(dirname(join(out, name)), { recursive: true })
      cpSync(join(projectRoot, name), join(out, name))
    }
  }
  for (const path of ["vitest.config.ts", "tsconfig.json", "package.json"])
    cpSync(join(projectRoot, path), join(out, path))
  symlinkSync(
    join(projectRoot, "node_modules"),
    join(out, "node_modules"),
    "dir"
  )
  writeJson(join(out, ".data-stage.json"), {
    ...config,
    captureFingerprint: capture.fingerprint,
  })
  for (const feature of config.features) {
    for (const path of FEATURES[feature].fixtures ?? []) {
      const source = capture.sources.find(
        (source) =>
          source.targetPath === path && source.features.includes(feature)
      )
      if (!source) throw new Error(`Freeze required manual fixture: ${path}`)
      cpSync(safePath(captureRoot, source.file), safePath(out, path))
    }
    for (const path of FEATURES[feature].public) {
      if (feature === "trees") continue
      rmSync(join(out, "public", path), { recursive: true, force: true })
    }
  }
  // Geometry/reference generators deliberately preserve existing files. Remove
  // only explicitly selected versions in the isolated stage, never the baseline.
  if (config.features.includes("trees"))
    for (const version of config.treeVersions) {
      for (const path of [
        "pob-trees/v4",
        "pob-trees/art-v2",
        "pob-trees/passives-v1",
      ])
        rmSync(join(out, "public", path, `${version}.json`), { force: true })
      rmSync(join(out, "public/pob-trees/node-reference-v1", version), {
        recursive: true,
        force: true,
      })
      rmSync(join(out, "public/pob-trees/ascendancies-v1", version), {
        recursive: true,
        force: true,
      })
    }
  const access = {},
    commands = [],
    sourceRecords = {}
  for (const feature of Object.keys(FEATURES).filter((feature) =>
    config.features.includes(feature)
  )) {
    for (const generator of FEATURES[feature].generators) {
      const script = join(projectRoot, "scripts", generator)
      const result = run(
        python,
        [
          script,
          ...(generator === "update-item-registry.py" ? ["--refresh"] : []),
        ],
        {
          cwd: out,
          env: {
            ...process.env,
            EXILE_DATA_STAGE: out,
            EXILE_DATA_CAPTURE: captureRoot,
          },
          stdio: "inherit",
        }
      )
      if (result.error || result.status !== 0)
        throw new Error(
          `Generator failed: ${generator}: ${result.error?.message ?? result.status}`
        )
      const requests = readJson(join(out, ".source-access.json"))
      if (requests.missing.length)
        throw new Error(
          `Uncaptured requests (including caught failures): ${requests.missing.join(", ")}`
        )
      for (const [url, hash] of Object.entries(requests.used)) {
        const source = capture.sources.find((source) => source.url === url)
        if (!source?.features.includes(feature))
          throw new Error(`Source not assigned to ${feature}: ${url}`)
        access[`${feature}/${source.id}`] = {
          feature,
          provider: source.provider,
          id: source.id,
          sha256: hash,
        }
        for (const [identity, digest] of Object.entries(
          requests.records?.[url] ?? {}
        ))
          sourceRecords[`${feature}/${source.id}/${identity}`] = digest
      }
      commands.push({ feature, generator })
    }
    for (const source of capture.sources.filter(
      (source) => source.features.includes(feature) && source.targetPath
    ))
      access[`${feature}/${source.id}`] = {
        feature,
        provider: source.provider,
        id: source.id,
        sha256: source.sha256,
      }
    for (const source of capture.sources.filter(
      (source) => source.features.includes(feature) && source.targetPath
    )) {
      const data = readJson(safePath(out, source.targetPath))
      const nested = ["nodes", "passives", "rows", "entries"].find(
        (key) => data[key] && typeof data[key] === "object"
      )
      const entries = nested
        ? {
            ...Object.fromEntries(
              Object.entries(data).filter(([key]) => key !== nested)
            ),
            ...Object.fromEntries(
              Object.entries(data[nested]).map(([key, value]) => [
                `${nested}/${key}`,
                value,
              ])
            ),
          }
        : data
      for (const [key, value] of Object.entries(entries))
        sourceRecords[`${feature}/${source.id}/${key}`] = fingerprint(value)
    }
  }
  const audit = auditGameData(out),
    before = auditGameData(baseline)
  const diff = compareAudits(before, audit)
  const accounting = allAccounting(out)
  const outputFiles = filesUnder(out, paths)
  const issueEntries = []
  for (const source of Object.values(access)) {
    const captured = capture.sources.find((row) => row.id === source.id)
    if (captured?.status !== 200)
      issueEntries.push({
        id: `capture-status/${source.feature}/${source.id}`,
        status: "review",
        reason: `Captured HTTP ${captured?.status}`,
      })
  }
  for (const path of new Set([
    ...Object.keys(baselineFiles),
    ...Object.keys(outputFiles),
  ]))
    if (baselineFiles[path] !== outputFiles[path])
      issueEntries.push({
        id: `artifact/${path}`,
        status: "review",
        reason: !outputFiles[path]
          ? "Removed output"
          : !baselineFiles[path]
            ? "New output"
            : "Output bytes changed",
        before: baselineFiles[path],
        after: outputFiles[path],
      })
  // Compare raw definitions independently of generated output. A new record
  // discarded by an old parser still blocks acceptance until explicitly reviewed.
  const baselineRecords = {}
  const selected = existsSync(join(baseline, "shared/data-release.json"))
    ? readJson(join(baseline, "shared/data-release.json"))
    : { releases: {} }
  for (const [feature, id] of Object.entries(selected.releases)) {
    const release = readReleaseRecord(baseline, id)
    Object.assign(
      baselineRecords,
      Object.fromEntries(
        Object.entries(release.sourceRecords ?? {}).filter(([identity]) =>
          identity.startsWith(feature + "/")
        )
      )
    )
  }
  for (const [identity, hash] of Object.entries(sourceRecords))
    if (baselineRecords[identity] !== hash)
      issueEntries.push({
        id: `raw/${identity}`,
        status: "review",
        reason: baselineRecords[identity]
          ? "Raw definition changed"
          : "Newly captured raw definition",
        sha256: hash,
      })
  for (const identity of Object.keys(baselineRecords))
    if (
      config.features.some((feature) => identity.startsWith(feature + "/")) &&
      !Object.hasOwn(sourceRecords, identity)
    )
      issueEntries.push({
        id: `raw-removed/${identity}`,
        status: "review",
        reason: "Previously consumed raw definition absent",
      })
  for (const [id, entry] of Object.entries(accounting))
    if (entry.status !== "imported")
      issueEntries.push({ id: `accounting/${id}`, ...entry })
  for (const [dataset, delta] of Object.entries(diff.datasets)) {
    for (const action of ["added", "removed", "changed"])
      for (const value of delta[action])
        issueEntries.push({
          id: `diff/${dataset}/${action}/${typeof value === "string" ? value : value.id}`,
          status: "review",
          details: value,
        })
  }
  for (const page of diff.poe2dbPages.removed)
    issueEntries.push({
      id: `coverage/poe2db/${page}`,
      status: "unknown",
      reason: "Previously covered page missing",
    })
  for (const id of audit.output.coverage.missingEffects)
    if (config.features.includes("gems"))
      issueEntries.push({
        id: `coverage/effects/${id}`,
        status: "partial",
        reason: "Missing effect file",
      })
  for (const feature of config.features)
    for (const path of Object.keys(outputFiles).filter(
      (path) =>
        (path.endsWith("source.json") || path.endsWith("-source.json")) &&
        featurePaths(feature).some(
          (root) => path === root || path.startsWith(root + "/")
        )
    )) {
      const source = readJson(join(out, path))
      for (const [key, values] of Object.entries(source))
        if (
          (/diagnostics$/i.test(key) || key === "failedDownloads") &&
          Array.isArray(values)
        ) {
          for (const [index, value] of values.entries())
            issueEntries.push({
              id: `diagnostic/${feature}/${path}/${key}/${index}`,
              status: "review",
              details: value,
            })
        }
    }
  const testInputs = filesUnder(out, [
    "shared",
    "src",
    "scripts/data",
    "vitest.config.ts",
    "tsconfig.json",
    "package.json",
  ])
  const stageAssets = filesUnder(out, ["public"])
  const manifest = {
    schemaVersion: 1,
    config,
    runtime,
    captureRoot,
    captureFingerprint: capture.fingerprint,
    captureSources: capture.sources,
    baselineFiles,
    baselineRegistry: registry,
    outputFiles,
    testInputs,
    stageAssets,
    toolchain: tools,
    sourceAccess: access,
    sourceRecords,
    commands,
    accounting,
    issues: issueEntries,
    audit: audit.output,
    diff,
  }
  manifest.publication = materializeBundle(out, manifest)
  manifest.fingerprint = fingerprint(manifest)
  writeJson(join(out, "candidate.json"), manifest)
  writeJson(join(out, "review.json"), {
    schemaVersion: 1,
    candidateFingerprint: manifest.fingerprint,
    targetPatch: config.targetPatch,
    scope: {
      complete: false,
      officialUrl: config.officialUrl,
      reviewer: "",
      reason: "",
    },
    sourceReviews: [],
    ledger: [],
    issueReviews: [],
    mechanics: [],
  })
  return manifest
}

export function verifyCandidate(root) {
  const manifest = readJson(join(root, "candidate.json"))
  const { fingerprint: expected, ...content } = manifest
  if (fingerprint(content) !== expected)
    throw new Error("Candidate manifest changed")
  if (
    verifyCapture(manifest.captureRoot).fingerprint !==
    manifest.captureFingerprint
  )
    throw new Error("Candidate capture changed")
  verifyFiles(root, manifest.outputFiles)
  verifyFiles(root, manifest.testInputs)
  if (
    fingerprint(
      filesUnder(root, [
        "shared",
        "src",
        "scripts/data",
        "vitest.config.ts",
        "tsconfig.json",
        "package.json",
      ])
    ) !== fingerprint(manifest.testInputs)
  )
    throw new Error("Candidate test input set changed")
  verifyFiles(root, manifest.stageAssets)
  if (
    fingerprint(filesUnder(root, ["public"])) !==
    fingerprint(manifest.stageAssets)
  )
    throw new Error("Staged public assets changed")
  const paths = manifest.config.features.flatMap(featurePaths)
  if (
    fingerprint(filesUnder(root, paths)) !== fingerprint(manifest.outputFiles)
  )
    throw new Error("Candidate file set changed")
  verifyFiles(projectRoot, manifest.toolchain)
  if (fingerprint(toolchain(projectRoot)) !== fingerprint(manifest.toolchain))
    throw new Error("Toolchain file set changed; regenerate")
  verifyFiles(join(root, ".release-bundle"), manifest.publication.publicFiles)
  verifyFiles(join(root, ".release-shared"), manifest.publication.sharedFiles)
  if (
    fingerprint(filesUnder(root, [".release-bundle"])) !==
    fingerprint(
      Object.fromEntries(
        Object.entries(manifest.publication.publicFiles).map(([path, hash]) => [
          `.release-bundle/${path}`,
          hash,
        ])
      )
    )
  )
    throw new Error("Publication file set changed")
  return manifest
}
export function testCandidate(root, { run = spawnSync } = {}) {
  const manifest = verifyCandidate(root)
  rmSync(join(root, "tests.json"), { force: true })
  const result = run(
    join(projectRoot, "node_modules/.bin/vitest"),
    ["run", "shared", "--maxWorkers=2"],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        POE2DB_DRAFTS: join(resolve(root), ".poe2db-draft-differences.json"),
      },
    }
  )
  if (result.error || result.status !== 0)
    throw new Error("Candidate domain tests failed")
  verifyCandidate(root)
  const receipt = {
    schemaVersion: 1,
    candidateFingerprint: manifest.fingerprint,
    command: candidateTestCommand,
    passed: true,
  }
  writeJson(join(root, "tests.json"), receipt)
  return receipt
}

/** Draft a capture inventory from known provenance; new upstream files are discovered
 * from pinned directory listings or reported as uncaptured requests, never fetched by generation. */
export function draftCapturePlan({
  releaseId,
  targetPatch,
  officialUrl,
  features,
  pobRevision,
  treeVersions = [],
  baseline = projectRoot,
}) {
  const sources = new Map()
  const add = (url, feature, options = {}) => {
    if (
      url.startsWith(
        "https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/"
      )
    )
      url = url.replace(
        /\/PathOfBuilding-PoE2\/[a-f0-9]{40}\//,
        `/PathOfBuilding-PoE2/${pobRevision}/`
      )
    if (
      url.startsWith(
        "https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/"
      )
    )
      url = url.replace(/([?&]ref=)[a-f0-9]{40}/, `$1${pobRevision}`)
    const provider =
      options.provider ??
      (url.includes("PathOfBuilding-PoE2")
        ? "pob"
        : url.startsWith("https://repoe-fork.github.io/")
          ? "repoe"
          : "artwork")
    if (sources.has(url))
      Object.assign(sources.get(url), options, {
        features: [...new Set([...sources.get(url).features, feature])],
      })
    else
      sources.set(url, {
        id: `${provider}-${sha256(url.replace(/[a-f0-9]{40}/g, "REVISION")).slice(0, 16)}`,
        provider,
        url,
        features: [feature],
        ...options,
      })
  }
  const manifests = {
    economy: ["shared/catalog-source.json"],
    items: ["public/items/v1/source.json"],
    gems: ["public/gems/v1/source.json", "public/gems/effects-v1/source.json"],
    augments: ["public/augments/v1/source.json"],
    equipment: [
      "shared/equipment-art-source.json",
      "shared/socket-art-source.json",
    ],
  }
  for (const feature of features) {
    if (!FEATURES[feature]) throw new Error(`Unknown feature: ${feature}`)
    for (const path of manifests[feature] ?? []) {
      const manifest = readJson(
        join(baseline, selectedDataPath(baseline, path))
      )
      if (typeof manifest.sha256 === "string")
        add(
          manifest.url ??
            (manifest.source?.endsWith(".lua")
              ? manifest.source
              : manifest.source + "base_items.min.json"),
          feature
        )
      else
        for (const path of Object.keys(manifest.sha256 ?? {}))
          add(
            path.startsWith("https://")
              ? path
              : (manifest.source ?? "https://repoe-fork.github.io/poe2/") +
                  (path.includes(".") || path.includes("/")
                    ? path
                    : path + ".min.json"),
            feature
          )
    }
    for (const targetPath of FEATURES[feature].fixtures ?? []) {
      const local = join(resolve(baseline), targetPath)
      const source = readJson(local).source
      const provider =
        feature === "items"
          ? "manual"
          : targetPath.endsWith("options.json")
            ? "poe2db"
            : "repoe"
      sources.set(`local:${targetPath}`, {
        id: `fixture-${sha256(targetPath).slice(0, 16)}`,
        provider,
        local,
        targetPath,
        features: [feature],
        sha256: sha256(readFileSync(local)),
        provenance: source ?? "Reviewed local game-data supplement",
      })
    }
  }
  if (features.includes("items")) {
    for (const directory of ["Bases", "Uniques"])
      add(
        `https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/${directory}?ref=${pobRevision}`,
        "items",
        { discover: true }
      )
    const snapshot = readJson(
      join(baseline, "scripts/data/poe2db-modifier-pools.json")
    )
    const pages = new Set(Object.values(snapshot.pages).map((page) => page.url))
    for (const kind of [
      "Body_Armours",
      "Helmets",
      "Gloves",
      "Boots",
      "Shields",
    ])
      for (const attributes of [
        "str",
        "dex",
        "int",
        "str_dex",
        "str_int",
        "dex_int",
        "str_dex_int",
      ])
        pages.add(`https://poe2db.tw/us/${kind}_${attributes}`)
    for (const page of [
      "Talismans",
      "Bows",
      "Quivers",
      "Wands",
      "Staves",
      "Sceptres",
      "Quarterstaves",
      "Crossbows",
      "Spears",
      "Claws",
      "Daggers",
      "Flails",
      "One_Hand_Swords",
      "Two_Hand_Swords",
      "One_Hand_Axes",
      "Two_Hand_Axes",
      "One_Hand_Maces",
      "Two_Hand_Maces",
      "Foci",
      "Bucklers",
      "Amulets",
      "Rings",
      "Belts",
      "Life_Flasks",
      "Mana_Flasks",
      "Charms",
    ])
      pages.add(`https://poe2db.tw/us/${page}`)
    for (const url of pages)
      add(url, "items", { provider: "poe2db", allowMissing: true })
  }
  if (features.includes("gems")) {
    add(
      `https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/StatDescriptions/Specific_Skill_Stat_Descriptions?ref=${pobRevision}`,
      "gems",
      { discover: true }
    )
    for (const name of ["keywords", "skills"])
      add(`https://repoe-fork.github.io/poe2/${name}.min.json`, "gems")
  }
  if (features.includes("trees"))
    for (const version of treeVersions)
      add(
        `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/${pobRevision}/src/TreeData/${version}/tree.json`,
        "trees"
      )
  for (const feature of ["atlas", "genesis"].filter((feature) =>
    features.includes(feature)
  )) {
    const rawPath =
      feature === "atlas"
        ? "shared/fixtures/atlas/Atlas.json"
        : "shared/fixtures/genesis/BrequelTree.json"
    const data = readJson(join(baseline, rawPath))
    const mirror =
      feature === "atlas"
        ? `https://raw.githubusercontent.com/juddisjudd/atlas.exilecompass.com/${readFileSync(join(projectRoot, "scripts/build-atlas-assets.py"), "utf8").match(/ART_COMMIT = "([a-f0-9]+)"/)[1]}/static/icons/`
        : "https://cdn.poe2db.tw/image/"
    for (const entry of Object.values(data.passives))
      if (entry.icon?.endsWith(".dds"))
        add(
          mirror +
            (feature === "atlas"
              ? encodeURIComponent(
                  entry.icon
                    .split("/")
                    .at(-1)
                    .replace(/\.dds$/, ".webp")
                )
              : entry.icon.replace(/\.dds$/, ".webp")),
          feature,
          { provider: "artwork", allowMissing: feature === "atlas" }
        )
  }
  for (const source of sources.values()) {
    if (
      source.url?.endsWith("/skill_gems.min.json") &&
      source.features.includes("gems")
    )
      source.artwork = "gem-icons"
    if (
      source.features.includes("equipment") &&
      source.url?.endsWith("/base_items.min.json")
    )
      source.artwork = "equipment-bases"
    if (
      source.features.includes("equipment") &&
      source.url?.endsWith("/uniques.min.json")
    )
      source.artwork = "equipment-uniques"
  }
  const config = {
    schemaVersion: 1,
    releaseId,
    targetPatch,
    officialUrl,
    features,
    pobRevision,
    treeVersions,
    sources: [...sources.values()],
  }
  return validateConfig(config)
}
