import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import type { TreeData } from "../shared/tree-render-model"

const trees = [
  {
    route: "atlas",
    data: "atlas-trees/v2/tree.json",
    ids: ["38896", "20223", "38492"],
  },
  {
    route: "genesis",
    data: "genesis-trees/v1/tree.json",
    ids: ["7811", "38137"],
  },
]

for (const width of [1440, 390]) {
  for (const { route: treeRoute, data, ids } of trees) {
    const tree = JSON.parse(readFileSync("public/" + data, "utf8")) as TreeData
    for (const id of ids) {
      const node = tree.nodes.find((node) => node.id === id)!
      test(`${treeRoute} choices: ${node.name} at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 })
        // Isolate an actual exported node so its hit target is reachable without
        // tying this tooltip regression to the camera's initial fit or node layout.
        await page.route("**/" + data, (route) =>
          route.fulfill({
            json: { ...tree, nodes: [{ ...node, x: 0, y: 0 }], edges: [] },
          })
        )
        await page.goto("/trees/" + treeRoute)
        const target = page.locator(`[data-node="${id}"]`)
        if (width === 390) await target.click()
        else await target.hover()
        const tooltip = page.locator("[data-inspection-tooltip=true]")
        await expect(tooltip).toBeVisible()
        const options = tooltip.getByRole("list", { name: "Available options" })
        await expect(options.getByRole("listitem")).toHaveText(node.options!)
        const bounds = (await tooltip.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth
          )
        ).toBe(false)
        if (width === 390) {
          await tooltip.evaluate((element) => {
            element.scrollTop = element.scrollHeight
          })
          await expect(options.getByRole("listitem").last()).toBeInViewport()
        }
      })
    }
  }
}
