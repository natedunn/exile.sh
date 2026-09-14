import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import tree from "../public/atlas-trees/v2/tree.json"
import art from "../public/atlas-trees/v2/art.json"
import previous from "../public/atlas-trees/v1/tree.json"
import choices from "./fixtures/atlas/options.json"
import source from "./fixtures/atlas/Atlas.json"

describe("Atlas snapshot", () => {
  it("adds choices without changing geometry, stats, or connections", () => {
    expect(tree.edges).toEqual(previous.edges)
    expect(tree.nodes.map(({ options: _options, ...node }) => node)).toEqual(
      previous.nodes
    )
    expect(tree.nodes.filter((node) => node.options?.length)).toHaveLength(43)
    for (const [id, choice] of Object.entries(choices.nodes)) {
      const node = tree.nodes.find((candidate) => candidate.id === id)!
      expect(node.options).toEqual(choice.options)
      expect(
        node.options?.every((option) => option.trim() && !option.includes("["))
      ).toBe(true)
    }
    expect(tree.nodes.find((node) => node.id === "38896")?.options).toEqual([
      "Forest",
      "Water",
    ])
    expect(tree.nodes.find((node) => node.id === "57514")?.options?.[1]).toBe(
      "Breaches have 20% reduced Pack Size\n20% increased Effectiveness of Breach Monsters"
    )
    expect(tree.nodes.find((node) => node.id === "21939")?.options).not.toEqual(
      tree.nodes.find((node) => node.id === "38492")?.options
    )
  })
  it("retains every non-decorative source node and valid connections", () => {
    const expected = Object.values(source.passives)
      .filter((n) => !n.is_icon_only)
      .map((n) => String(n.hash))
      .sort()
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(expected)
    const ids = new Set(expected)
    expect(
      new Set(tree.edges.map((e) => [e.from, e.to].sort().join(":"))).size
    ).toBe(tree.edges.length)
    for (const edge of tree.edges) {
      expect(ids.has(edge.from) && ids.has(edge.to)).toBe(true)
      expect(edge.from).not.toBe(edge.to)
      expect(edge.path).not.toMatch(/NaN|Infinity/)
    }
    for (const node of tree.nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true)
      expect(node.name).not.toBe("")
      expect(node.stats.join(" ")).not.toContain("[")
    }
    for (const root of source.roots) expect(ids.has(String(root))).toBe(true)
  })
  it("pins its source and provides local artwork for every icon", () => {
    expect(
      createHash("sha256")
        .update(readFileSync("shared/fixtures/atlas/Atlas.json"))
        .digest("hex")
    ).toBe(tree.source.sha256)
    for (const node of tree.nodes) {
      const path = (art as Record<string, string>)[node.icon]
      expect(path).toMatch(/^\/atlas-trees\/v1\/icons\//)
      expect(existsSync("public" + path)).toBe(true)
    }
  })
})
