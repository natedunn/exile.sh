import { expect, test } from "vitest"
import { batchTreeConnections } from "./tree-connections"

test("batches identical strokes without changing independent connection geometry", () => {
  const edges = [
    { from: "a", to: "b", path: "M 0 0 L 10 0" },
    { from: "b", to: "c", path: "M 10 0 A 10 10 0 0 1 20 10" },
    { from: "c", to: "d", path: "M 20 10 L 30 10" },
  ]
  const batches = batchTreeConnections(edges, new Set(), new Map(), new Set())
  expect(batches).toEqual([
    {
      style: "unallocated",
      path: edges.map((e) => e.path).join(" "),
      count: 3,
    },
  ])
  expect(edges[0].path).toBe("M 0 0 L 10 0")
})
test("allocation takes precedence over unseen nodes and preserves weapon-set selection", () => {
  const ids = [
    ["a", "b"],
    ["b", "c"],
    ["d", "e"],
    ["f", "g"],
    ["h", "i"],
    ["a", "j"],
    ["x", "y"],
  ]
  const edges = ids.map(([from, to], i) => ({
    from,
    to,
    path: `M ${i} 0 L ${i} 1`,
  }))
  const selected = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i"])
  const sets = new Map<string, 0 | 1 | 2>([
    ["b", 1],
    ["c", 2],
    ["e", 2],
    ["f", 2],
    ["g", 1],
  ])
  const groups = batchTreeConnections(
    edges,
    selected,
    sets,
    new Set(["b", "j"])
  )
  expect(Object.fromEntries(groups.map((g) => [g.style, g.count]))).toEqual({
    "weapon-1": 2,
    "weapon-2": 2,
    allocated: 1,
    unseen: 1,
    unallocated: 1,
  })
  expect(groups.find((g) => g.style === "weapon-1")!.path).toContain(
    edges[1].path
  )
  expect(groups.find((g) => g.style === "weapon-2")!.path).toContain(
    edges[3].path
  )
  expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(edges.length)
  expect(batchTreeConnections([], selected, sets, new Set())).toEqual([])
})
