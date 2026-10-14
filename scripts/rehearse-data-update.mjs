import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  cpSync,
  readFileSync,
  existsSync,
} from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { parseArgs } from "node:util"
import {
  captureSources,
  generateCandidate,
  testCandidate,
  projectRoot,
  draftCapturePlan,
} from "./lib/data-pipeline.mjs"
import {
  sourceGroups,
  checkCandidate,
  preparePublication,
  verifySelectedRelease,
  rollbackSelection,
} from "./lib/data-acceptance.mjs"
import {
  writeJson,
  sha256,
  readJson,
  selectedDataPath,
} from "./lib/data-pipeline-files.mjs"

try {
  const { values } = parseArgs({ options: { out: { type: "string" } } })
  const root = values.out
    ? resolve(values.out)
    : mkdtempSync(join(tmpdir(), "exile-patch-rehearsal-"))
  if (values.out) {
    if (existsSync(root)) throw new Error("Use a new rehearsal directory")
    mkdirSync(root, { recursive: true })
  }
  const url = "https://repoe-fork.github.io/poe2/base_items.min.json"
  const config = draftCapturePlan({
    releaseId: "local-rehearsal",
    targetPatch: "synthetic-rehearsal",
    officialUrl: "https://example.invalid/synthetic-notes",
    features: ["economy", "atlas"],
  })
  const originalTree = readJson(
    join(
      projectRoot,
      selectedDataPath(projectRoot, "public/atlas-trees/v2/tree.json")
    )
  )
  const originalArt = readJson(
    join(
      projectRoot,
      selectedDataPath(projectRoot, "public/atlas-trees/v2/art.json")
    )
  )
  const images = new Map(
    Object.entries(originalArt).map(([icon, path]) => [
      icon
        .split("/")
        .at(-1)
        .replace(/\.dds$/, ".webp"),
      readFileSync(
        join(projectRoot, selectedDataPath(projectRoot, "public" + path))
      ),
    ])
  )
  const bytes = Buffer.from(
    JSON.stringify({
      "Metadata/Items/Currency/Rehearsal": {
        name: "Rehearsal Orb",
        item_class: "StackableCurrency",
        release_state: "released",
        properties: { description: "Synthetic new reference effect" },
      },
      FutureSystem: {
        name: "Unrecognized System",
        item_class: "Future Class",
        release_state: "released",
      },
    })
  )
  // All upstream responses are injected fixtures; this command performs no source requests.
  const capture = join(root, "capture"),
    candidate = join(root, "candidate"),
    checkout = join(root, "publication")
  await captureSources(config, capture, {
    fetcher: async (request) => {
      if (request === url) return new Response(bytes)
      const image = images.get(
        decodeURIComponent(new URL(request).pathname.split("/").at(-1))
      )
      return image
        ? new Response(image)
        : new Response("Unused fixture image", { status: 404 })
    },
  })
  const manifest = generateCandidate(capture, candidate)
  if (checkCandidate(candidate).ready)
    throw new Error("Unreviewed candidate incorrectly accepted")
  testCandidate(candidate)
  const review = {
    schemaVersion: 1,
    candidateFingerprint: manifest.fingerprint,
    targetPatch: config.targetPatch,
    scope: {
      complete: true,
      officialUrl: config.officialUrl,
      reviewer: "Rehearsal fixture",
      reason: "Explicit synthetic scope; no assertion about a real patch",
    },
    sourceReviews: Object.entries(sourceGroups(manifest)).map(
      ([key, hash]) => ({
        feature: key.split("/")[0],
        provider: key.split("/")[1],
        hash,
        targetPatch: config.targetPatch,
        status: key.startsWith("atlas/") ? "not-affected" : "verified",
        reviewer: "Rehearsal fixture",
        evidence: `Existing frozen Atlas fixture or injected fixture source SHA-256 ${sha256(bytes)}`,
      })
    ),
    ledger: [
      {
        id: "new-description",
        feature: "economy",
        officialUrl: config.officialUrl,
        description: "Synthetic new reference description",
        status: "verified",
        reviewer: "Rehearsal fixture",
        evidence:
          "Exact expected value in the injected raw and generated fixture",
        artifact: "shared/catalog.json",
        path: ["0", "description"],
        operator: "equal",
        expected: "Synthetic new reference effect",
      },
    ],
    issueReviews: [
      {
        ids: manifest.issues.map((issue) => issue.id),
        disposition: "verified",
        reviewer: "Rehearsal fixture",
        reason:
          "All synthetic fixture differences enumerated; unsupported class remains explicitly excluded",
        evidence:
          "Fixture has one allowed currency and one deliberately unknown class",
      },
    ],
    mechanics: config.features.map((feature) => ({
      feature,
      kind: "unchanged",
      status: "verified",
      agent: "Rehearsal fixture",
      evidence:
        "Synthetic metadata and identical frozen Atlas semantics; no new mechanic claimed",
    })),
  }
  review.ledger.push({
    id: "atlas-coverage",
    feature: "atlas",
    officialUrl: config.officialUrl,
    description: "Retain every visible node from the frozen Atlas fixture",
    status: "verified",
    reviewer: "Rehearsal fixture",
    evidence:
      "Expected node count comes from the existing verified fixture geometry",
    artifact: "public/atlas-trees/v2/tree.json",
    path: ["nodes", "length"],
    operator: "equal",
    expected: originalTree.nodes.length,
  })

  const reviewPath = join(candidate, "review.json")
  const lagged = structuredClone(review)
  lagged.sourceReviews[0].status = "waiting"
  writeJson(reviewPath, lagged)
  if (checkCandidate(candidate).ready)
    throw new Error("Waiting source incorrectly accepted")
  writeJson(reviewPath, review)
  if (!checkCandidate(candidate).ready)
    throw new Error("Verified fixture failed acceptance")
  mkdirSync(checkout)
  cpSync(join(projectRoot, "shared"), join(checkout, "shared"), {
    recursive: true,
  })
  cpSync(join(projectRoot, "public"), join(checkout, "public"), {
    recursive: true,
  })
  for (const path of ["scripts", "src"])
    cpSync(join(projectRoot, path), join(checkout, path), { recursive: true })
  for (const path of ["package.json", "vitest.config.ts", "tsconfig.json"])
    cpSync(join(projectRoot, path), join(checkout, path))
  ;(await import("node:fs")).symlinkSync(
    join(projectRoot, "node_modules"),
    join(checkout, "node_modules"),
    "dir"
  )
  // Include already selected releases when rehearsing from a newer real baseline.
  if (existsSync(join(projectRoot, "public/data-releases")))
    cpSync(
      join(projectRoot, "public/data-releases"),
      join(checkout, "public/data-releases"),
      { recursive: true }
    )
  if (existsSync(join(projectRoot, "data/releases")))
    cpSync(
      join(projectRoot, "data/releases"),
      join(checkout, "data/releases"),
      { recursive: true }
    )
  const baseline = readFileSync(join(checkout, "shared/catalog.json"))
  preparePublication(candidate, { checkout })
  verifySelectedRelease(checkout)
  const selectedTests = spawnSync(
    join(projectRoot, "node_modules/.bin/vitest"),
    ["run", "shared", "--maxWorkers=2"],
    { cwd: checkout, stdio: "inherit" }
  )
  if (selectedTests.error || selectedTests.status !== 0)
    throw new Error("Published-selection domain tests failed")
  rollbackSelection(config.releaseId, checkout)
  if (!readFileSync(join(checkout, "shared/catalog.json")).equals(baseline))
    throw new Error("Rollback did not restore the baseline")
  const result = {
    passed: true,
    networkSourceRequests: 0,
    candidateFingerprint: manifest.fingerprint,
    issuesReviewed: manifest.issues.length,
    tests: "vitest run shared --maxWorkers=2",
    waitingSourceBlocked: true,
    publicationVerified: true,
    publishedSelectionTests: true,
    rollbackVerified: true,
    directory: root,
  }
  writeJson(join(root, "rehearsal.json"), result)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error.stack ?? error.message)
  process.exitCode = 1
}
