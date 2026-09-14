import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import manifest from "./generated/ascendancy-trees.json"

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"))
test("ascendancy chunks preserve exact versioned geometry and artwork", () => {
  for (const [version, choices] of Object.entries(manifest)) {
    const source = read(`public/pob-trees/v4/${version}.json`)
    const art = read(`public/pob-trees/art-v2/${version}.json`)
    expect(
      choices
        .filter((c) => c.value !== "Abyssal Lich")
        .map((c) => c.value)
        .sort()
    ).toEqual(
      [
        ...new Set(
          source.nodes
            .map((n: { ascendancy: string }) => n.ascendancy)
            .filter(Boolean)
        ),
      ].sort()
    )
    for (const choice of choices.filter((c) => c.value !== "Abyssal Lich")) {
      const chunk = read("public" + choice.data)
      expect(chunk.nodes).toEqual(
        source.nodes.filter(
          (n: { ascendancy: string }) => n.ascendancy === choice.value
        )
      )
      const ids = new Set(chunk.nodes.map((n: { id: string }) => n.id))
      expect(chunk.edges).toEqual(
        source.edges.filter(
          (e: { from: string; to: string }) => ids.has(e.from) && ids.has(e.to)
        )
      )
      expect(read("public" + choice.art)).toEqual(
        Object.fromEntries(
          chunk.nodes
            .filter((n: { icon: string }) => art[n.icon])
            .map((n: { icon: string }) => [n.icon, art[n.icon]])
        )
      )
    }
  }
})
