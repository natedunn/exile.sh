import { test } from "node:test"
import assert from "node:assert/strict"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  cpSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"
import {
  captureSources,
  generateCandidate,
  projectRoot,
  verifyCandidate,
  verifyCapture,
  testCandidate,
  draftCapturePlan,
} from "./lib/data-pipeline.mjs"
import {
  evaluateAcceptance,
  sourceGroups,
  checkCandidate,
  preparePublication,
  verifySelectedRelease,
  rollbackSelection,
} from "./lib/data-acceptance.mjs"
import {
  fingerprint,
  readJson,
  sha256,
  writeJson,
} from "./lib/data-pipeline-files.mjs"

function temp(t) {
  const root = mkdtempSync(join(tmpdir(), "exile-data-pipeline-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
function acceptanceFixture(t, features = ["economy"]) {
  const root = temp(t)
  writeJson(join(root, "artifact.json"), { value: 20, effects: ["New effect"] })
  const manifest = {
    fingerprint: "candidate-hash",
    config: {
      features,
      targetPatch: "1.0-test",
      officialUrl: "https://example.com/official",
    },
    outputFiles: { "artifact.json": "hash" },
    sourceAccess: {},
    issues: [{ id: "new-effect", status: "unknown" }],
  }
  for (const feature of features)
    for (const provider of feature === "items"
      ? ["pob", "repoe", "poe2db", "manual"]
      : ["repoe"])
      manifest.sourceAccess[`${feature}/${provider}`] = {
        id: provider,
        feature,
        provider,
        sha256: provider + "-hash",
      }
  const review = readyReview(manifest)
  const tests = {
    passed: true,
    command: "vitest run shared --maxWorkers=2",
    candidateFingerprint: manifest.fingerprint,
  }
  return { root, manifest, review, tests }
}
function readyReview(manifest) {
  return {
    schemaVersion: 1,
    candidateFingerprint: manifest.fingerprint,
    targetPatch: manifest.config.targetPatch,
    scope: {
      complete: true,
      officialUrl: manifest.config.officialUrl,
      reviewer: "Developer",
      reason: "All affected official patch sections reviewed",
    },
    sourceReviews: Object.entries(sourceGroups(manifest)).map(
      ([key, hash]) => ({
        feature: key.split("/")[0],
        provider: key.split("/")[1],
        hash,
        targetPatch: manifest.config.targetPatch,
        status: "verified",
        reviewer: "Agent",
        evidence: "Explicit source file and patch change evidence inspected",
      })
    ),
    issueReviews: manifest.issues.length
      ? [
          {
            ids: manifest.issues.map((row) => row.id),
            disposition: "verified",
            reason:
              "Every listed fixture change inspected against expected data",
            evidence:
              "Synthetic rehearsal fixture with explicit expected changes",
            reviewer: "Agent",
          },
        ]
      : [],
    mechanics: manifest.config.features.map((feature) => ({
      feature,
      kind: "unchanged",
      status: "verified",
      agent: "Agent",
      evidence: "Fixture changes only reference values, no new mechanic",
    })),
    ledger: [
      {
        id: "change",
        feature: manifest.config.features[0],
        officialUrl: manifest.config.officialUrl,
        description: "Expected numerical fixture patch change",
        status: "verified",
        reviewer: "Agent",
        evidence: "Checked expected fixture value and source bytes",
        artifact: "artifact.json",
        path: ["value"],
        operator: "equal",
        expected: 20,
      },
    ],
  }
}

test("staggered sources block items regardless of which provider catches up first", (t) => {
  const { root, manifest, review, tests } = acceptanceFixture(t, ["items"])
  assert.equal(
    evaluateAcceptance(manifest, review, { root, tests }).ready,
    true
  )
  for (const provider of ["pob", "repoe", "poe2db"]) {
    const lagged = structuredClone(review)
    lagged.sourceReviews.find((row) => row.provider === provider).status =
      "waiting"
    assert.equal(
      evaluateAcceptance(manifest, lagged, { root, tests }).ready,
      false
    )
  }
})

test("stale evidence, omitted effects and unresolved mechanics cannot pass", (t) => {
  const { root, manifest, review, tests } = acceptanceFixture(t)
  for (const mutate of [
    (r) => {
      r.candidateFingerprint = "old"
    },
    (r) => {
      r.sourceReviews[0].hash = "old"
    },
    (r) => {
      r.issueReviews = []
    },
    (r) => {
      r.ledger[0].expected = 21
    },
    (r) => {
      r.ledger[0].status = "waiting"
    },
    (r) => {
      r.mechanics[0].kind = "new"
    },
    (r) => {
      r.scope.complete = false
    },
  ]) {
    const changed = structuredClone(review)
    mutate(changed)
    assert.equal(
      evaluateAcceptance(manifest, changed, { root, tests }).ready,
      false
    )
  }
  assert.equal(
    evaluateAcceptance(manifest, review, {
      root,
      tests: { ...tests, candidateFingerprint: "old" },
    }).ready,
    false
  )
  review.mechanics[0].kind = "new"
  review.mechanics[0].developer = "Developer"
  assert.equal(
    evaluateAcceptance(manifest, review, { root, tests }).ready,
    true
  )
  review.ledger[0] = {
    ...review.ledger[0],
    path: ["effects"],
    operator: "contains",
    expected: "New effect",
  }
  assert.equal(
    evaluateAcceptance(manifest, review, { root, tests }).ready,
    true
  )
  review.ledger[0].expected = "Missing effect"
  assert.equal(
    evaluateAcceptance(manifest, review, { root, tests }).ready,
    false
  )
})

test("capture is immutable and failed/truncated or hash-changed sources never seal", async (t) => {
  const root = temp(t),
    bytes = Buffer.from('{"a":1}')
  const config = {
    schemaVersion: 1,
    releaseId: "fixture-release",
    targetPatch: "test",
    officialUrl: "https://example.com/notes",
    features: ["economy"],
    sources: [
      {
        id: "base",
        provider: "repoe",
        url: "https://example.com/base.json",
        features: ["economy"],
        sha256: sha256(bytes),
      },
    ],
  }
  await captureSources(config, join(root, "capture"), {
    fetcher: async () => new Response(bytes),
  })
  assert.equal(verifyCapture(join(root, "capture")).sources.length, 1)
  await assert.rejects(
    captureSources(config, join(root, "capture")),
    /already exists/
  )
  await assert.rejects(
    captureSources(config, join(root, "bad"), {
      fetcher: async () => new Response("changed"),
    }),
    /Source changed/
  )
  assert.equal(existsSync(join(root, "bad/capture.json")), false)
  const capture = readJson(join(root, "capture/capture.json"))
  writeFileSync(join(root, "capture", capture.sources[0].file), "tampered")
  assert.throws(() => verifyCapture(join(root, "capture")), /Artifact changed/)
})

test("generators refuse the working checkout without a stage", () => {
  const env = { ...process.env }
  delete env.EXILE_DATA_STAGE
  delete env.EXILE_DATA_CAPTURE
  const result = spawnSync(
    "python3",
    [join(projectRoot, "scripts/update-catalog.py")],
    { env, encoding: "utf8" }
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /generated in isolation/)
})

test("offline generation, review, publication and rollback retention rehearse end to end", async (t) => {
  const root = temp(t)
  const source = {
    "Metadata/Items/Currency/Fixture": {
      name: "Fixture Orb",
      item_class: "StackableCurrency",
      release_state: "released",
      properties: { description: "New fixture effect" },
    },
    "ignored-new-system": {
      name: "Future",
      item_class: "Brand New Class",
      release_state: "released",
    },
  }
  const config = {
    schemaVersion: 1,
    releaseId: "rehearsal-release",
    targetPatch: "1.0-rehearsal",
    officialUrl: "https://example.com/official",
    features: ["economy"],
    sources: [
      {
        id: "base",
        provider: "repoe",
        url: "https://repoe-fork.github.io/poe2/base_items.min.json",
        features: ["economy"],
      },
    ],
  }
  const capture = join(root, "capture"),
    candidate = join(root, "candidate")
  await captureSources(config, capture, {
    fetcher: async () => Response.json(source),
  })
  const manifest = generateCandidate(capture, candidate)
  assert.ok(
    manifest.issues.some((row) => row.id.includes("ignored-new-system"))
  )
  assert.equal(checkCandidate(candidate).ready, false)
  const review = readyReview(manifest)
  review.ledger = [
    {
      ...review.ledger[0],
      artifact: "shared/catalog.json",
      path: ["0", "description"],
      expected: "New fixture effect",
    },
  ]
  writeJson(join(candidate, "review.json"), review)
  assert.equal(checkCandidate(candidate).ready, false) // tests are still required
  testCandidate(candidate, { run: () => ({ status: 0 }) })
  assert.equal(checkCandidate(candidate).ready, true)
  const checkout = join(root, "checkout")
  mkdirSync(checkout)
  cpSync(join(projectRoot, "shared"), join(checkout, "shared"), {
    recursive: true,
  })
  for (const path of ["scripts", "src"])
    cpSync(join(projectRoot, path), join(checkout, path), { recursive: true })
  cpSync(join(projectRoot, "package.json"), join(checkout, "package.json"))
  const old = readFileSync(join(checkout, "shared/catalog.json"))
  preparePublication(candidate, { checkout })
  assert.equal(verifySelectedRelease(checkout).ready, true)
  assert.notDeepEqual(readFileSync(join(checkout, "shared/catalog.json")), old)
  assert.equal(
    existsSync(
      join(checkout, "public/data-releases/rehearsal-release/release.json")
    ),
    true
  )
  const copied = readJson(
    join(checkout, "public/data-releases/rehearsal-release/release.json")
  )
  assert.equal(copied.candidateFingerprint, manifest.fingerprint)
  rollbackSelection("rehearsal-release", checkout)
  assert.deepEqual(readFileSync(join(checkout, "shared/catalog.json")), old)
  assert.equal(
    existsSync(
      join(checkout, "public/data-releases/rehearsal-release/release.json")
    ),
    true
  )
  writeFileSync(join(candidate, "shared/catalog.json"), "[]")
  assert.throws(() => verifyCandidate(candidate), /Artifact changed/)
  assert.throws(
    () => preparePublication(candidate, { checkout }),
    /Artifact changed/
  )
})

test("item extraction accounts for unfamiliar domains and generation types", async (t) => {
  const root = temp(t),
    revision = "a".repeat(40)
  const pob = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/${revision}/src/Data/`
  const repoe = "https://repoe-fork.github.io/poe2/",
    payloads = new Map()
  const add = (url, value) =>
    payloads.set(url, typeof value === "string" ? value : JSON.stringify(value))
  for (const directory of ["Bases", "Uniques"])
    add(
      `https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/${directory}?ref=${revision}`,
      []
    )
  for (const name of [
    "ModItem.lua",
    "ModFlask.lua",
    "ModCharm.lua",
    "ModJewel.lua",
    "ModCorrupted.lua",
    "ModVeiled.lua",
    "Essence.lua",
  ])
    add(pob + name, name === "ModItem.lua" ? '["Allowed"] = {}' : "return {}")
  const allowed = {
    generation_type: "prefix",
    domain: "item",
    name: "Fixture",
    text: "+5 Strength",
    required_level: 1,
    groups: ["Strength"],
    implicit_tags: [],
    adds_tags: [],
    spawn_weights: [],
    is_essence_only: false,
  }
  add(repoe + "mods.min.json", {
    Allowed: allowed,
    NewDomain: { ...allowed, domain: "future_system" },
    NewGeneration: { ...allowed, generation_type: "future_type" },
  })
  const bases = {},
    augments = {}
  for (const [tag, slot] of [
    ["Soul", "Body Armour"],
    ["Berserking", "Helmet"],
    ["Decay", "Gloves"],
    ["Marksman", "Gloves"],
    ["Chronomancy", "Boots"],
    ["Destruction", "Martial Weapon"],
  ]) {
    bases[tag] = { name: tag + " Rune", release_state: "released" }
    augments[tag] = {
      type_id: "Rune",
      categories: { [slot]: { stat_text: [`Can roll ${tag} modifiers`] } },
    }
  }
  add(repoe + "base_items.min.json", bases)
  add(repoe + "augments.min.json", augments)
  add(repoe + "uniques.min.json", {})
  const config = {
    schemaVersion: 1,
    releaseId: "item-fixture",
    targetPatch: "test",
    officialUrl: "https://example.com/notes",
    pobRevision: revision,
    features: ["items"],
    sources: [...payloads].map(([url], i) => ({
      id: `source-${i}`,
      provider: url.includes("PathOfBuilding") ? "pob" : "repoe",
      url,
      features: ["items"],
    })),
  }
  const capture = join(root, "capture"),
    stage = join(root, "stage")
  await captureSources(config, capture, {
    fetcher: async (url) => new Response(payloads.get(url)),
  })
  writeJson(join(stage, ".data-stage.json"), config)
  writeJson(join(stage, "scripts/data/unique-runeforging.json"), {
    uniques: [],
  })
  writeJson(join(stage, "scripts/data/runeforging-recipes.json"), {
    rows: [],
    source: "https://example.com/recipes",
    reviewed: "2026-10-14",
  })
  const result = spawnSync(
    "python3",
    [join(projectRoot, "scripts/update-item-registry.py"), "--refresh"],
    {
      env: {
        ...process.env,
        EXILE_DATA_STAGE: stage,
        EXILE_DATA_CAPTURE: capture,
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, result.stderr)
  const ledger = readJson(
    join(stage, ".data-accounting/update-item-registry.json")
  ).records
  assert.equal(ledger["mod:Allowed"].status, "imported")
  assert.equal(ledger["mod:NewDomain"].reason, "Unsupported domain")
  assert.equal(
    ledger["mod:NewGeneration"].reason,
    "Unsupported generation type"
  )
  assert.deepEqual(
    Object.keys(readJson(join(stage, "public/items/v1/modifiers.json")).mods),
    ["Allowed"]
  )
})

test("uncaptured requests stay visible even if a generator catches the exception", async (t) => {
  const root = temp(t),
    config = {
      schemaVersion: 1,
      releaseId: "missing-fixture",
      targetPatch: "test",
      officialUrl: "https://example.com/notes",
      features: ["economy"],
      sources: [
        {
          id: "captured",
          provider: "repoe",
          url: "https://example.com/captured.json",
          features: ["economy"],
        },
      ],
    }
  const capture = join(root, "capture"),
    stage = join(root, "stage")
  await captureSources(config, capture, {
    fetcher: async () => Response.json({}),
  })
  writeJson(join(stage, ".data-stage.json"), config)
  const code = `import sys; sys.path.insert(0, ${JSON.stringify(join(projectRoot, "scripts"))})\nfrom data_sources import build_root\nimport urllib.request\nbuild_root(${JSON.stringify(join(projectRoot, "scripts/update-catalog.py"))})\ntry:\n urllib.request.urlopen('https://example.invalid/not-captured')\nexcept OSError:\n pass\n`
  const result = spawnSync("python3", ["-c", code], {
    env: {
      ...process.env,
      EXILE_DATA_STAGE: stage,
      EXILE_DATA_CAPTURE: capture,
    },
    encoding: "utf8",
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readJson(join(stage, ".source-access.json")).missing, [
    "https://example.invalid/not-captured",
  ])
})

test("capture discovers new pinned files and shares artwork inputs across features", async (t) => {
  const root = temp(t),
    revision = "b".repeat(40)
  const directory = `https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/contents/src/Data/Bases?ref=${revision}`
  const newFile = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/${revision}/src/Data/Bases/New.lua`
  const baseUrl = "https://repoe-fork.github.io/poe2/base_items.min.json",
    gemUrl = "https://repoe-fork.github.io/poe2/skill_gems.min.json",
    image = "https://repoe-fork.github.io/poe2/Art/Shared.webp"
  const config = {
    schemaVersion: 1,
    releaseId: "discovery-fixture",
    targetPatch: "test",
    officialUrl: "https://example.com/notes",
    features: ["items", "equipment", "gems"],
    pobRevision: revision,
    sources: [
      {
        id: "directory",
        provider: "pob",
        url: directory,
        discover: true,
        features: ["items"],
      },
      {
        id: "bases",
        provider: "repoe",
        url: baseUrl,
        artwork: "equipment-bases",
        features: ["equipment"],
      },
      {
        id: "gems",
        provider: "repoe",
        url: gemUrl,
        artwork: "gem-icons",
        features: ["gems"],
      },
    ],
  }
  const payloads = new Map([
    [
      directory,
      JSON.stringify([
        { name: "New.lua", type: "file", download_url: newFile },
      ]),
    ],
    [newFile, 'itemBases["New"] = {}'],
    [
      baseUrl,
      JSON.stringify({
        id: {
          item_class: "Ring",
          release_state: "released",
          visual_identity: { dds_file: "Art/Shared.dds" },
        },
      }),
    ],
    [gemUrl, JSON.stringify({ id: { icon_dds_file: "Art/Shared.dds" } })],
    [image, "fixture-image"],
  ])
  const calls = []
  const capture = await captureSources(config, join(root, "capture"), {
    fetcher: async (url) => {
      calls.push(url)
      return new Response(payloads.get(url))
    },
  })
  assert.ok(capture.sources.some((source) => source.url === newFile))
  assert.deepEqual(
    capture.sources.find((source) => source.url === image).features,
    ["equipment", "gems"]
  )
  assert.equal(calls.filter((url) => url === image).length, 1)
})

test("capture can preserve an explicitly allowed 404 but never treats it as data", async (t) => {
  const root = temp(t),
    config = {
      schemaVersion: 1,
      releaseId: "absent-fixture",
      targetPatch: "test",
      officialUrl: "https://example.com/notes",
      features: ["items"],
      pobRevision: "a".repeat(40),
      sources: [
        {
          id: "absent",
          provider: "poe2db",
          url: "https://example.com/absent",
          allowMissing: true,
          features: ["items"],
        },
      ],
    }
  const result = await captureSources(config, join(root, "capture"), {
    fetcher: async () => new Response("not found", { status: 404 }),
  })
  assert.equal(result.sources[0].status, 404)
  assert.equal(verifyCapture(join(root, "capture")).sources[0].status, 404)
})
