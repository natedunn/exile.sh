import { expect, test } from "vitest"
import {
  containsTreeView,
  overlapsTreeRect,
  treeEdgeBounds,
  treeRenderRect,
  treeNodeRegions,
} from "./tree-visibility"

test("render buffers absorb small pans and refresh before their edges enter view", () => {
  const rect = treeRenderRect(0, 0, 1000, 600)
  expect(containsTreeView(rect, 80, 0, 1000, 600)).toBe(true)
  expect(containsTreeView(rect, 400, 0, 1000, 600)).toBe(false)
})
test("crossing lines and arcs stay visible with both endpoints offscreen", () => {
  const rect = { minX: -50, maxX: 50, minY: -1050, maxY: -950 }
  expect(
    overlapsTreeRect(treeEdgeBounds("M -1000 0 A 1000 1000 0 0 1 1000 0"), rect)
  ).toBe(true)
  expect(
    overlapsTreeRect(treeEdgeBounds("M -1000 -1000 L 1000 -1000"), rect)
  ).toBe(true)
  expect(overlapsTreeRect(treeEdgeBounds("M -1000 0 L 1000 0"), rect)).toBe(
    false
  )
  expect(overlapsTreeRect(treeEdgeBounds("M 0 0 C 0 1 2 3 4 5"), rect)).toBe(
    true
  )
})
test("minor arc bounds include sampled points on either side of their chord", () => {
  for (const angle of [0, 0.5, 1, 2])
    for (const halfAngle of [0.1, 0.5, 1, Math.PI / 2]) {
      const r = 500
      const a = {
        x: r * Math.cos(angle - halfAngle),
        y: r * Math.sin(angle - halfAngle),
      }
      const b = {
        x: r * Math.cos(angle + halfAngle),
        y: r * Math.sin(angle + halfAngle),
      }
      const bounds = treeEdgeBounds(
        `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
      )
      for (let i = 0; i <= 20; i++) {
        const t = angle - halfAngle + (2 * halfAngle * i) / 20
        const x = r * Math.cos(t),
          y = r * Math.sin(t)
        expect(
          x >= bounds.minX &&
            x <= bounds.maxX &&
            y >= bounds.minY &&
            y <= bounds.maxY
        ).toBe(true)
      }
    }
})

test("regions retain unique node ownership across positive and negative boundaries", () => {
  const nodes = [
    { id: "left", x: -1, y: -1 },
    { id: "origin", x: 0, y: 0 },
    { id: "inside", x: 1199, y: 1199 },
    { id: "right", x: 1200, y: 1200 },
  ]
  const regions = treeNodeRegions(nodes)
  expect(regions).toHaveLength(3)
  expect(new Set(regions.map((region) => region.id)).size).toBe(3)
  expect(regions.flatMap((region) => region.nodes)).toEqual(nodes)
  for (const region of regions)
    for (const node of region.nodes) {
      expect(nodes).toContain(node)
      expect(region.bounds.minX).toBeLessThanOrEqual(node.x - 108)
      expect(region.bounds.maxX).toBeGreaterThanOrEqual(node.x + 108)
      expect(region.bounds.minY).toBeLessThanOrEqual(node.y - 108)
      expect(region.bounds.maxY).toBeGreaterThanOrEqual(node.y + 108)
    }
  expect(treeNodeRegions([])).toEqual([])
})

test("region selection retains arrays and artwork crossing the viewport edge", () => {
  const nodes = [
    { x: -20, y: 0 },
    { x: 2500, y: 0 },
  ]
  const regions = treeNodeRegions(nodes)
  const view = { minX: 0, maxX: 100, minY: -100, maxY: 100 }
  const visible = regions.filter((region) =>
    overlapsTreeRect(region.bounds, view)
  )
  expect(visible).toHaveLength(1)
  expect(visible[0]).toBe(regions[0])
  expect(visible[0].nodes).toBe(regions[0].nodes)
  expect(visible[0].nodes[0]).toBe(nodes[0])
})
