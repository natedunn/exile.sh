import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it } from "vitest"
import { TreeExplorer } from "../src/components/passive-tree"
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
