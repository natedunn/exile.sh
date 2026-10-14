import { readDataFileSync as readFileSync } from "./data-test-files"
import { createHash } from "node:crypto"
import { expect, test } from "vitest"

const bytes = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url))
const read = <T>(path: string): T => JSON.parse(bytes(path).toString("utf8"))
const digest = (path: string) =>
  createHash("sha256").update(bytes(path)).digest("hex")

type Source = {
  source: string
  revision: string
  sha256: Record<string, string>
}

// Check only data joined at runtime. Independent features and historical trees
// may legitimately use different revisions; equal revisions do not prove patch readiness.
test("gem descriptions, effects, headers, aliases and compatibility share their pinned inputs", () => {
  const gems = read<Source>("public/gems/v1/source.json")
  const effects = read<Source>("public/gems/effects-v1/source.json")
  const headers = read<{ version: string; sha256: Record<string, string> }>(
    "public/gems/v1/headers.json"
  )
  expect(effects.revision).toBe(gems.revision)
  expect(headers.version).toBe(gems.revision)
  expect(
    read<{ revision: string }>("shared/gem-name-aliases.json").revision
  ).toBe(gems.revision)
  expect(
    read<{ sourceRevision: string }>(
      "public/gems/v1/support-compatibility.json"
    ).sourceRevision
  ).toBe(gems.revision)

  for (const [path, hash] of Object.entries(headers.sha256)) {
    expect(gems.sha256[gems.source + path], path).toBe(hash)
  }
  const sharedSkills = [
    "act_str",
    "act_dex",
    "act_int",
    "sup_str",
    "sup_dex",
    "sup_int",
    "other",
  ]
  for (const name of sharedSkills) {
    const path = `Skills/${name}.lua`
    const hash = gems.sha256[gems.source + path]
    expect(hash, path).toMatch(/^[a-f0-9]{64}$/)
    expect(effects.sha256[`Data/${path}`], path).toBe(hash)
  }
})

test("augment references and build tooltip text derive from the same source", () => {
  const reference = read<unknown>("public/augments/v1/source.json")
  expect(read<unknown>("shared/augment-modifiers-source.json")).toEqual(
    reference
  )
})

test("item recipe inputs match the hashes recorded by the generated registry", () => {
  const source = read<{
    runeforgingMappings: {
      file: string
      sha256: string
      publishedRecipes: { file: string; sha256: string }
    }
  }>("public/items/v1/source.json")
  const recipes = source.runeforgingMappings
  for (const input of [recipes, recipes.publishedRecipes]) {
    expect(digest(input.file), input.file).toBe(input.sha256)
  }
})

test("manual tree supplements remain bound to the exact frozen tree they describe", () => {
  const atlasHash = digest("shared/fixtures/atlas/Atlas.json")
  const genesisHash = digest("shared/fixtures/genesis/BrequelTree.json")
  expect(
    read<{ source: { atlasSha256: string } }>(
      "shared/fixtures/atlas/options.json"
    ).source.atlasSha256
  ).toBe(atlasHash)
  for (const path of ["options.json", "stat-translations.json"]) {
    expect(
      read<{ source: { genesisSha256: string } }>(
        `shared/fixtures/genesis/${path}`
      ).source.genesisSha256,
      path
    ).toBe(genesisHash)
  }
})
