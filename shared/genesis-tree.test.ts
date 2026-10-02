import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import tree from "../public/genesis-trees/v1/tree.json"
import art from "../public/genesis-trees/v1/art.json"
import choices from "./fixtures/genesis/options.json"
import source from "./fixtures/genesis/BrequelTree.json"

describe("Genesis Tree snapshot", () => {
  it("retains every visible source node and valid connections", () => {
    const roots = new Set(source.roots)
    const expected = Object.values(source.passives)
      .filter((n) => !roots.has(n.hash))
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
    // Each Womb now roots its branch in place of the hidden anchor.
    const wombs = tree.nodes.filter((n) => n.keystone)
    expect(wombs.map((n) => n.name).sort()).toEqual([
      "Amulet Womb",
      "Belt Womb",
      "Breachstone Womb",
      "Currency Womb",
      "Ring Womb",
    ])
    expect(new Set(tree.nodes.map((n) => n.womb))).toEqual(
      new Set(["Currency", "Amulet", "Ring", "Belt", "Breachstone"])
    )
  })
  it("describes every passive with game text", () => {
    for (const node of tree.nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true)
      expect(node.name).not.toBe("")
      const text = [...node.stats, ...(node.options ?? [])].join(" ")
      expect(text).not.toMatch(/[[\]{}_]/)
      // Wombs are the only passives the game shows without effects.
      if (!node.name.endsWith(" Womb")) expect(text).not.toBe("")
    }
    expect(tree.nodes.find((n) => n.id === "7811")).toMatchObject({
      name: "Potential Ignored",
      stats: ["Birthed Items cannot be"],
      options: [
        "Birthed Items cannot be Amber Amulets",
        "Birthed Items cannot be Lapis Amulets",
        "Birthed Items cannot be Jade Amulets",
        "Birthed Items cannot be Stellar Amulets",
      ],
    })
    expect(tree.nodes.filter((n) => n.options?.length)).toHaveLength(
      Object.keys(choices.nodes).length
    )
  })
  it("pins its sources and provides local artwork for every icon", () => {
    const digest = createHash("sha256")
      .update(readFileSync("shared/fixtures/genesis/BrequelTree.json"))
      .digest("hex")
    expect(tree.source.sha256).toBe(digest)
    expect(tree.source.statTranslations.genesisSha256).toBe(digest)
    expect(tree.source.options.genesisSha256).toBe(digest)
    for (const node of tree.nodes) {
      const path = (art as Record<string, string>)[node.icon]
      expect(path).toMatch(/^\/genesis-trees\/v1\/icons\//)
      expect(existsSync("public" + path)).toBe(true)
    }
  })
})
