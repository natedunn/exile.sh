import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { referencedClassLists } from "./classname-references.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))

test("resolves project path aliases for shared class lists", (t) => {
  const { files } = fixture(t, {
    "../tsconfig.json": JSON.stringify({
      compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
    }),
    "styles.ts": 'export const field = "bg-field text-ink";',
    "view.tsx":
      'import { field } from "@/styles"; export const view = <input className={field} />;',
  })
  assert.ok(
    referencedClassLists(files).some(
      ({ value }) => value === "bg-field text-ink"
    )
  )
})
function fixture(t, sources) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "classname-review-"))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const files = []
  for (const [name, source] of Object.entries(sources)) {
    const file = path.join(directory, "src", name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, source)
    if (/\.tsx?$/.test(file)) files.push(file)
  }
  return { directory, files }
}

test("follows imported and re-exported class constants without treating prose as classes", (t) => {
  const { files } = fixture(t, {
    "styles.ts":
      'export const drawer = "absolute bg-surface"; export const prose = "Not a class list";',
    "barrel.ts": 'export { drawer as panel } from "./styles";',
    "view.tsx":
      'import { panel } from "./barrel"; const local = "p-3"; const one = <div className={panel} />; const two = <div className={cn(local, panel)} />;',
  })
  const values = referencedClassLists(files).map((entry) => entry.value)
  assert.ok(values.includes("absolute bg-surface"))
  assert.ok(values.includes("p-3"))
  assert.ok(!values.includes("Not a class list"))
})

test("follows aliases and conditional class constants safely through cycles", (t) => {
  const { files } = fixture(t, {
    "view.tsx":
      'const first = second; const second = first; const active = "text-ink"; const idle = "text-ink-muted"; const state = flag ? active : idle; const view = <div className={cn(first, state)} />;',
  })
  assert.deepEqual(
    referencedClassLists(files)
      .map((entry) => entry.value)
      .sort(),
    ["text-ink", "text-ink-muted"]
  )
})

test("the actual lint command rejects a typo in an imported module-level class list", (t) => {
  const { directory } = fixture(t, {
    "styles.ts": 'export const itemCard = "flex bg-review-typo";',
    "view.tsx":
      'import { itemCard } from "./styles"; export const view = <div className={itemCard} />;',
    "styles.css": `@import "${path.join(root, "node_modules/tailwindcss/index.css")}";`,
  })
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/check-classnames.mjs"), "--list"],
    { cwd: directory, encoding: "utf8" }
  )
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stdout, /bg-review-typo.*src\/styles\.ts/)
  assert.match(result.stdout, /1 not recognised/)
})
