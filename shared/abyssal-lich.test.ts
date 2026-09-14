import { readFileSync, existsSync } from "node:fs"
import { expect, test } from "vitest"
import manifest from "./generated/ascendancy-trees.json"
import fixture from "./fixtures/pob/abyssal-lich-options.json"

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"))
test("Abyssal Lich applies source overrides and remaps all connections", () => {
  for (const version of ["0_3", "0_4", "0_5"] as const) {
    const choice = manifest[version].find((c) => c.value === "Abyssal Lich")!
    const tree = read("public" + choice.data)
    const base = read(`public/pob-trees/ascendancies-v1/${version}/lich.json`)
    const art = read("public" + choice.art)
    const options = fixture.versions[version] as Record<
      string,
      { id?: number; name?: string; icon?: string; stats?: string[] }
    >
    expect(tree.nodes).toHaveLength(base.nodes.length)
    const remap = new Map<string, string>()
    for (const n of base.nodes) {
      const opt = options[n.id]
      const id = String(opt.id ?? n.id)
      remap.set(n.id, id)
      const node = tree.nodes.find((x: { id: string }) => x.id === id)
      expect(node).toEqual({
        ...n,
        id,
        baseId: n.id,
        ascendancy: "Abyssal Lich",
        name: opt.name ?? n.name,
        icon: opt.icon ?? n.icon,
        stats: opt.stats ?? n.stats,
      })
      if (!node.icon.endsWith("MasteryBlank.dds"))
        expect(existsSync("public" + art[node.icon])).toBe(true)
    }
    expect(tree.edges).toEqual(
      base.edges.map((e: { from: string; to: string }) => ({
        ...e,
        from: remap.get(e.from),
        to: remap.get(e.to),
      }))
    )
    expect(
      tree.nodes.some((n: { name: string }) => n.name === "Umbral Well")
    ).toBe(true)
    expect(
      tree.nodes.some((n: { name: string }) => n.name === "Necromantic Conduit")
    ).toBe(false)
  }
  for (const version of ["0_1", "0_2"] as const)
    expect(manifest[version].some((c) => c.value === "Abyssal Lich")).toBe(
      false
    )
})
