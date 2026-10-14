import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  auditGameData,
  compareAudits,
  diffRecords,
} from "./lib/game-data-audit.mjs"

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "exile-data-audit-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (path, data) => {
    const target = join(root, path)
    mkdirSync(join(target, ".."), { recursive: true })
    writeFileSync(target, JSON.stringify(data))
  }
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
    write(path, { revision: "example", diagnostics: [] })
  write("public/items/v1/catalogue.json", {
    items: { base: { id: "base", requirements: { level: 1 } } },
  })
  write("public/items/v1/modifiers.json", {
    mods: {},
    essences: [],
    augments: [],
    augmentSlots: {},
    influences: [],
  })
  write("public/gems/v1/catalogue.json", {
    gems: { gem: { skillId: "Skill" }, missing: { skillId: "Missing" } },
  })
  write("public/gems/v1/headers.json", { gems: {}, skills: {} })
  write("public/gems/v1/support-compatibility.json", { supports: {} })
  write("public/gems/v1/search-index.json", {})
  write("public/gems/v1/keywords.json", { keywords: {} })
  write("public/gems/v1/keyword-aliases.json", {
    aliases: {},
    descriptions: {},
  })
  write("shared/gem-name-aliases.json", { aliases: {} })
  const effect = {
    sets: {
      1: { levels: { 1: { lines: ["5 Damage"], partial: true } }, quality: {} },
    },
  }
  write("public/gems/effects-v1/Skill.json", effect)
  write("public/gems/effects-v1/OldSkill.json", effect)
  write("scripts/data/poe2db-modifier-pools.json", {
    captured: "2026-10-14",
    pages: { Wands: { pools: {} } },
  })
  return { root, write }
}

test("audit exposes missing, stale and partial effects without certifying a patch", (t) => {
  const { root } = fixture(t)
  const { output } = auditGameData(root)
  assert.equal(output.patchMatch, "unverified")
  assert.deepEqual(output.coverage.missingEffects, ["Missing"])
  assert.deepEqual(output.coverage.orphanEffects, ["OldSkill"])
  assert.deepEqual(
    output.coverage.partialEffects.map((row) => [row.id, row.levels]),
    [
      ["OldSkill", 1],
      ["Skill", 1],
    ]
  )
  assert.match(
    output.artifacts["public/gems/effects-v1/Skill.json"],
    /^[a-f0-9]{64}$/
  )
})

test("comparison reports changed numeric fields, new effects and lost comparison pages", (t) => {
  const { root, write } = fixture(t)
  const before = auditGameData(root)
  write("public/items/v1/catalogue.json", {
    items: {
      base: { id: "base", requirements: { level: 2 } },
      newBase: { id: "newBase" },
    },
  })
  write("public/gems/effects-v1/Skill.json", {
    sets: {
      1: {
        levels: { 1: { lines: ["10 Damage", "New effect"], partial: false } },
      },
    },
  })
  write("scripts/data/poe2db-modifier-pools.json", { pages: {} })
  const diff = compareAudits(before, auditGameData(root))
  assert.deepEqual(diff.datasets.items.added, ["newBase"])
  assert.deepEqual(diff.datasets.items.changed, [
    { id: "base", fields: ["requirements"] },
  ])
  assert.deepEqual(diff.datasets.effects.changed, [
    { id: "Skill", fields: ["sets"] },
  ])
  assert.deepEqual(diff.poe2dbPages.removed, ["Wands"])
  assert.equal(diff.coverageChanged, true)
  assert.ok(diff.changedArtifacts.includes("public/gems/effects-v1/Skill.json"))
})

test("same counts cannot hide replacements, removals or new modifier fields", () => {
  const diff = diffRecords(
    { old: { text: "10 damage" }, kept: { text: "5 damage" } },
    {
      new: { text: "10 damage" },
      kept: { text: "5 damage", addsTags: ["new_rule"] },
    }
  )
  assert.deepEqual(diff.added, ["new"])
  assert.deepEqual(diff.removed, ["old"])
  assert.deepEqual(diff.changed, [{ id: "kept", fields: ["addsTags"] }])
})

test("missing and malformed input fail instead of becoming empty coverage", (t) => {
  const { root, write } = fixture(t)
  write("public/gems/effects-v1/Skill.json", {
    sets: { 1: { levels: { 1: { lines: [] } } } },
  })
  assert.throws(() => auditGameData(root), /Invalid effect entry/)
  rmSync(join(root, "public/gems/effects-v1/Skill.json"))
  write("public/items/v1/modifiers.json", {
    mods: [],
    essences: [],
    augments: [],
  })
  assert.throws(() => auditGameData(root), /Expected object: mods/)
  rmSync(join(root, "public/items/v1/source.json"))
  assert.throws(() => auditGameData(root), /ENOENT/)
})

test("duplicate IDs fail and reordered object keys do not create false diffs", (t) => {
  assert.deepEqual(
    diffRecords({ id: { a: 1, b: 2 } }, { id: { b: 2, a: 1 } }).changed,
    []
  )
  const { root, write } = fixture(t)
  write("public/items/v1/modifiers.json", {
    mods: {},
    essences: [{ id: "duplicate" }, { id: "duplicate" }],
    augments: [],
    augmentSlots: {},
    influences: [],
  })
  assert.throws(() => auditGameData(root), /duplicate essence ID/)
})
