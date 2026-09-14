import { existsSync, readFileSync } from "node:fs"
import { expect, test } from "vitest"
import backgrounds from "./generated/ascendancy-backgrounds.json"

test("every versioned ascendancy has local circular background art", () => {
  for (const [version, images] of Object.entries(backgrounds.versions)) {
    const tree = JSON.parse(
      readFileSync(`public/pob-trees/v4/${version}.json`, "utf8")
    ) as { nodes: { ascendancy: string }[] }
    const names = new Set(
      tree.nodes.map((node) => node.ascendancy).filter(Boolean)
    )
    for (const name of names) {
      const background = (
        images as Record<
          string,
          { image: string; x: number; y: number; width: number; height: number }
        >
      )[name]
      expect(background, `${version}: ${name}`).toBeDefined()
      expect(existsSync("public" + background.image)).toBe(true)
      expect(background.width).toBeGreaterThan(0)
      expect(background.width).toBe(background.height)
      expect(
        Number.isFinite(background.x) && Number.isFinite(background.y)
      ).toBe(true)
    }
  }
})
