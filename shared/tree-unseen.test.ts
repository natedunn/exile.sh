import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import unseen from "./generated/tree-unseen.json"

for (const [version, ids] of Object.entries(unseen.versions)) {
  test(version + " has source-pinned Oracle paths with valid geometry", () => {
    const tree = JSON.parse(
      readFileSync(
        new URL("../public/pob-trees/v4/" + version + ".json", import.meta.url),
        "utf8"
      )
    ) as {
      revision: string
      nodes: { id: string; ascendancy: string; name: string }[]
    }
    expect(tree.revision).toBe(unseen.revision)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(version === "0_4" || version === "0_5" ? 176 : 0)
    for (const id of ids) {
      expect(tree.nodes.find((node) => node.id === id)?.ascendancy).toBe("")
    }
    if (ids.length) {
      expect(ids).toContain("479") // Hidden Forms, not the unlock ascendancy itself.
      expect(ids).not.toContain("5571")
      expect(ids).not.toContain("11184") // Sinister socket has a different unlock constraint.
    }
  })
}
