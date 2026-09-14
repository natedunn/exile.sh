import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it } from "vitest"
import { readFileSync } from "node:fs"
import type { TreeData } from "./tree-render-model"
import { TreeExplorer, AscendancyTree } from "../src/components/passive-tree"
import type { TreePanelOptions } from "../src/components/passive-tree"

function render(options: TreePanelOptions = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(["passive-explorer-v1", "0_5"], {
    nodes: [
      {
        id: "1",
        name: "Test",
        x: 1000,
        y: 1000,
        stats: [],
        ascendancy: "",
        start: false,
        icon: "",
        notable: false,
        keystone: false,
      },
    ],
    edges: [],
  })
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(TreeExplorer, {
        type: "passive",
        version: "0_5",
        options: createElement("span", null, "Version control"),
        section: "Oracle",
        onSectionChange: () => {},
        showUnseen: false,
        onShowUnseenChange: () => {},
        ...options,
      })
    )
  )
  client.clear()
  return html
}

it("hides disabled panel controls and gates palette on allocations", () => {
  expect(render({ showPanel: false })).not.toContain(
    'class="tree-settings-panel"'
  )
  expect(render({ showVersionSelector: false })).not.toContain(
    "Version control"
  )
  expect(render({ showAscendancySelector: false })).not.toContain(
    'aria-label="Show ascendancy"'
  )
  expect(render({ defaultAscendancy: "Titan" })).not.toContain(
    'aria-label="Show ascendancy"'
  )
  expect(render({ defaultAscendancy: "Titan" })).not.toContain(
    "Paths Not Taken"
  )
  expect(render({ defaultAscendancy: "Oracle" })).toContain("Paths Not Taken")
  expect(render()).not.toContain('aria-label="Color vision"')
  expect(render({ allocatedNodes: ["1"] })).toContain(
    'aria-label="Color vision"'
  )
  expect(
    render({ allocatedNodes: ["1"], showPaletteSelector: false })
  ).not.toContain('aria-label="Color vision"')
})

it.each([1, 2] as const)(
  "preserves weapon set %s on remapped Abyssal Lich nodes and connections",
  (weapon) => {
    const tree = JSON.parse(
      readFileSync(
        "public/pob-trees/ascendancies-v1/0_5/abyssal-lich.json",
        "utf8"
      )
    ) as TreeData
    const pair = ["12474", "11705"].map((id) =>
      tree.nodes.find((node) => node.id === id)!
    )
    expect(pair.every((node) => node.baseId && node.baseId !== node.id)).toBe(
      true
    )
    for (const useBaseIds of [true, false]) {
      const ids = pair.map((node) => (useBaseIds ? node.baseId! : node.id))
      const client = new QueryClient()
      client.setQueryData(
        [
          "ascendancy-tree-v1",
          "/pob-trees/ascendancies-v1/0_5/abyssal-lich.json",
        ],
        tree
      )
      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(AscendancyTree, {
            version: "0_5",
            section: "Abyssal Lich",
            showSelector: false,
            nodes: ids,
            weaponSets: new Map(ids.map((id) => [id, weapon])),
          })
        )
      )
      expect(html).toContain(`data-node="12474" data-weapon-set="${weapon}"`)
      expect(html).toContain(`data-node="11705" data-weapon-set="${weapon}"`)
      expect(html).toContain(`data-node-fill="weapon-${weapon}"`)
      expect(html).toContain(`data-connection-style="weapon-${weapon}"`)
      client.clear()
    }
  }
)
