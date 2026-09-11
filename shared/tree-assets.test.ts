import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

for (const version of ["0_1", "0_2", "0_3", "0_4", "0_5"]) {
  test(
    version + " has finite coordinates and unique drawable connections",
    () => {
      const tree = JSON.parse(
        readFileSync(
          new URL(
            "../public/pob-trees/v3/" + version + ".json",
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
