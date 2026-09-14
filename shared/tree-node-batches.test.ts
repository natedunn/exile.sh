import { expect, test } from "vitest"
import {
  batchTreeDiscs,
  circleSubpath,
  nodePaintStyle,
  treePaintRuns,
} from "./tree-node-batches"
import type { TreeNode } from "./tree-render-model"

test("discs retain closed circular subpaths and separate paint styles", () => {
  const discs = [
    { x: -10, y: 20, r: 23, style: "unallocated" },
    { x: 200, y: 50, r: 58, style: "allocated" },
    { x: 500, y: -30, r: 38, style: "unallocated" },
  ]
  const batches = batchTreeDiscs(discs)
  expect(batches.map((b) => [b.style, b.count])).toEqual([
    ["unallocated", 2],
    ["allocated", 1],
  ])
  for (const batch of batches) {
    expect(batch.path.match(/\bM\b/g)).toHaveLength(batch.count)
    expect(batch.path.match(/\bA\b/g)).toHaveLength(batch.count * 2)
    expect(batch.path.match(/\bZ\b/g)).toHaveLength(batch.count)
    expect(batch.path).not.toMatch(/\bL\b/)
  }
  // Start at the rightmost point, matching the dashed circle's phase.
  expect(circleSubpath(discs[0])).toBe(
    "M 13 20 A 23 23 0 1 1 -33 20 A 23 23 0 1 1 13 20 Z"
  )
  expect(batchTreeDiscs([])).toEqual([])
})

test("overlapping paint cannot be reordered or merged across runs", () => {
  const discs = [
    { x: 0, y: 0, r: 10 },
    { x: 100, y: 0, r: 10 },
    { x: 0, y: 0, r: 5 },
    { x: 200, y: 0, r: 10 },
  ]
  const runs = treePaintRuns(discs, (disc) => disc)
  expect(runs).toEqual([discs.slice(0, 2), discs.slice(2)])
  expect(runs.flat()).toEqual(discs)
  // Include border extents: touching stroke bounds require separate painting.
  expect(
    treePaintRuns(
      [
        { x: 0, y: 0, r: 10 },
        { x: 20, y: 0, r: 10 },
      ],
      (disc) => disc
    )
  ).toHaveLength(2)
  expect(
    treePaintRuns([], (disc: { x: number; y: number; r: number }) => disc)
  ).toEqual([])
})

test("node paint distinguishes allocation, unseen paths and weapon palettes", () => {
  const node = { id: "n", unseenPaths: true } as TreeNode
  const selected = new Set([node.id])
  expect(nodePaintStyle(node, new Set(), new Map([[node.id, 1]]))).toBe(
    "unseen"
  )
  expect(
    nodePaintStyle({ ...node, unseenPaths: false }, new Set(), new Map())
  ).toBe("unallocated")
  expect(nodePaintStyle(node, selected, new Map())).toBe("allocated")
  expect(nodePaintStyle(node, selected, new Map([[node.id, 1]]))).toBe(
    "weapon-1"
  )
  expect(nodePaintStyle(node, selected, new Map([[node.id, 2]]))).toBe(
    "weapon-2"
  )
})
