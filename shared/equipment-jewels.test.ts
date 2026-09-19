// @vitest-environment jsdom
import code from "./fixtures/pob/2k0EPn6QOhTx.txt?raw"
import { createElement } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { parseBuild } from "./pob"
import { BuildJewels, JewelStats } from "../src/components/build-jewels"

vi.mock("../src/components/equipment-display", () => ({
  ItemArtwork: () => null,
}))
vi.mock("../src/components/item-tooltip-content", () => ({
  ItemTooltipContent: ({ details }: { details: { name: string } }) =>
    createElement("h4", null, details.name),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

for (const state of ["absent", "unsupported", "loading", "failed"] as const) {
  for (const mixed of [false, true]) {
    test(`equipment jewels remain visible with ${state} tree data, mixed=${mixed}`, async () => {
      const build = parseBuild(code)
      const original = build.treeSpecs[build.activeSpec]
      const spec =
        state === "absent"
          ? undefined
          : {
              ...original,
              version: state === "unsupported" ? "unknown" : original.version,
              sockets: mixed ? original.sockets : [],
            }
      const item = {
        ...build.items[0],
        id: "9000",
        name: "Equipment Jewel",
        text: "Rarity: RARE\nEquipment Jewel\nSapphire\n+10 to Intelligence",
      }
      build.items.push(item)
      const gear = {
        ...build.itemSets[0],
        slots: [{ name: "Gloves Jewel Socket 1", itemId: item.id }],
      }
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          state === "failed"
            ? Promise.resolve(new Response("Unavailable", { status: 503 }))
            : new Promise<Response>(() => {})
        )
      )
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const view = render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(BuildJewels, { build, spec, gear }),
          createElement(JewelStats, { build, spec, gear })
        )
      )
      await waitFor(() => {
        expect(view.getByText("Equipment Jewel")).toBeTruthy()
        expect(
          view.container.querySelector('[data-slot="build-jewel-stats"]')
            ?.textContent
        ).toContain("10 to Intelligence")
        expect(
          view.container.querySelectorAll('[data-slot="build-jewel-card"]')
        ).toHaveLength(1)
        if (mixed && spec) {
          const text =
            state === "failed"
              ? "Tree data could not be loaded"
              : state === "loading"
                ? "Loading tree data"
                : "unavailable for this tree version"
          expect(
            view
              .getAllByRole("status")
              .every((node) => node.textContent.includes(text))
          ).toBe(true)
        } else expect(view.queryAllByRole("status")).toHaveLength(0)
      })
      client.clear()
    })
  }
}
