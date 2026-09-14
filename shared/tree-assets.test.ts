import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { TREE_VERSIONS } from "./tree-versions"

for (const { value: version } of TREE_VERSIONS) {
  test(
    version + " has finite coordinates and unique drawable connections",
    () => {
      const tree = JSON.parse(
        readFileSync(
          new URL(
            "../public/pob-trees/v4/" + version + ".json",
            import.meta.url
          ),
          "utf8"
        )
      ) as {
        nodes: {
          id: string
          x: number
          y: number
          ascendancy: string
          start: boolean
          keystone: boolean
        }[]
        edges: { from: string; to: string; path: string }[]
      }
      expect(tree.nodes.some((n) => n.keystone)).toBe(true)
      for (const n of tree.nodes) expect(typeof n.keystone).toBe("boolean")
      const nodes = new Map(tree.nodes.map((n) => [n.id, n]))
      const seen = new Set<string>()
      for (const n of tree.nodes)
        expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true)
      for (const e of tree.edges) {
        const a = nodes.get(e.from)!,
          b = nodes.get(e.to)!
        expect(a).toBeDefined()
        expect(b).toBeDefined()
        expect(a.ascendancy).toBe(b.ascendancy)
        expect(a.start || b.start).toBe(false)
        const key = [e.from, e.to].sort().join("-")
        expect(seen.has(key)).toBe(false)
        seen.add(key)
        expect(e.path).not.toMatch(/NaN|Infinity/)
      }
      expect(
        tree.edges.filter((e) => e.path.includes("A ")).length
      ).toBeGreaterThan(100)
    }
  )
}

// Independently extracted isOnlyImage IDs from the pinned upstream tree.json
// files. Do not infer decorations from names, empty stats, or missing artwork.
const imageOnly = JSON.parse(
  readFileSync(
    new URL("./fixtures/pob/image-only-nodes.json", import.meta.url),
    "utf8"
  )
) as { revision: string; versions: Record<string, string[]> }

for (const { value: version } of TREE_VERSIONS) {
  test(
    version + " removes only source-flagged decorations and their connections",
    () => {
      const read = (revision: string) =>
        JSON.parse(
          readFileSync(
            new URL(
              "../public/pob-trees/" + revision + "/" + version + ".json",
              import.meta.url
            ),
            "utf8"
          )
        ) as {
          revision: string
          nodes: { id: string; name: string; icon: string }[]
          edges: { from: string; to: string }[]
        }
      const before = read("v3")
      const after = read("v4")
      const excluded = new Set(imageOnly.versions[version])
      expect(excluded.size).toBeGreaterThan(200)
      expect(after.revision).toBe(imageOnly.revision)
      expect(after.nodes).toEqual(
        before.nodes.filter((node) => !excluded.has(node.id))
      )
      expect(after.edges).toEqual(
        before.edges.filter(
          (edge) => !excluded.has(edge.from) && !excluded.has(edge.to)
        )
      )
      expect(
        after.nodes.some((node) => node.name === "Energy Shield Mastery")
      ).toBe(false)
      if (version === "0_5") {
        expect(after.nodes).toContainEqual(
          expect.objectContaining({
            id: "11184",
            name: "Zarokh's Gift",
            icon: "",
          })
        )
      }
    }
  )
}
