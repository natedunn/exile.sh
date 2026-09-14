import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import choices from "./generated/ascendancy-trees.json"
import backgrounds from "./generated/ascendancy-backgrounds.json"
import { centerAscendancy, CENTER_ART_RADIUS } from "./tree-center-ascendancy"
import type { TreeBackground } from "./tree-center-ascendancy"
import type { TreeData } from "./tree-render-model"

describe("center ascendancy", () => {
  it("fits every snapshot in the center and keeps edge endpoints attached", () => {
    for (const [version, entries] of Object.entries(choices)) {
      for (const entry of entries) {
        const original = JSON.parse(
          readFileSync("public" + entry.data, "utf8")
        ) as TreeData
        const background = (
          backgrounds.versions as Record<string, Record<string, TreeBackground>>
        )[version][entry.value]
        const result = centerAscendancy(original, background)
        const nodes = new Map(result.nodes.map((node) => [node.id, node]))
        for (const node of result.nodes) {
          expect(Math.abs(node.x)).toBeLessThan(CENTER_ART_RADIUS)
          expect(Math.abs(node.y)).toBeLessThan(CENTER_ART_RADIUS)
          expect(node.id).toMatch(/^center:/)
        }
        for (const edge of result.edges) {
          const numbers = edge.path
            .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!
            .map(Number)
          expect(numbers[0]).toBeCloseTo(nodes.get(edge.from)!.x)
          expect(numbers[1]).toBeCloseTo(nodes.get(edge.from)!.y)
          expect(numbers.at(-2)).toBeCloseTo(nodes.get(edge.to)!.x)
          expect(numbers.at(-1)).toBeCloseTo(nodes.get(edge.to)!.y)
        }
      }
    }
  })
  it("main-only snapshots keep every main passive and omit ascendancies", () => {
    for (const version of Object.keys(choices)) {
      const full = JSON.parse(
        readFileSync(`public/pob-trees/v4/${version}.json`, "utf8")
      ) as TreeData
      const main = JSON.parse(
        readFileSync(`public/pob-trees/passives-v1/${version}.json`, "utf8")
      ) as TreeData
      expect(main.nodes).toEqual(full.nodes.filter((node) => !node.ascendancy))
      const ids = new Set(main.nodes.map((node) => node.id))
      expect(main.edges).toEqual(
        full.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))
      )
    }
  })
})
