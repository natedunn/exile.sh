// @vitest-environment jsdom
import { createElement as h } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, test, vi } from "vitest"
import { readFileSync } from "node:fs"
import { BuildJewels, JewelStats } from "../src/components/build-jewels"
import { parseBuild } from "./pob"

vi.mock("../src/components/equipment-display", () => ({
  ItemArtwork: () => null,
}))
vi.mock("../src/components/item-tooltip-content", () => ({
  ItemTooltipContent: () => null,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const build = parseBuild(
  readFileSync("shared/fixtures/pob/zarokhs-gift.txt", "utf8")
)
function renderJewels(version = build.treeSpecs[build.activeSpec].version) {
  const spec = { ...build.treeSpecs[build.activeSpec], version }
  const props = {
    build,
    spec,
    gear: build.itemSets.find((set) => set.id === build.activeItemSet),
  }
  return render(
    h(QueryClientProvider, {
      client: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      children: h("div", null, h(BuildJewels, props), h(JewelStats, props)),
    })
  )
}
test("waits for node names before displaying item-granted allocations and totals", async () => {
  let resolve!: (value: Response) => void
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
  )
  const view = renderJewels()
  expect(
    screen
      .getAllByRole("status")
      .every((el) => el.textContent.includes("Loading tree data"))
  ).toBe(true)
  expect(
    view.container.querySelector('[data-slot="build-jewel-stats"]')
  ).toBeNull()
  expect(screen.queryByText("Socket not allocated")).toBeNull()
  resolve(
    new Response(
      JSON.stringify({ nodes: [{ id: "11184", name: "Zarokh's Gift" }] })
    )
  )
  await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0))
  expect(screen.getByText("(Zarokh's Gift)")).toBeTruthy()
  expect(
    view.container.querySelector('[data-slot="build-jewel-stats"]')
  ).not.toBeNull()
})
test("failed tree requests do not present partial jewel totals", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 }))
  )
  const view = renderJewels()
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("status")
        .every((el) => el.textContent.includes("could not be loaded"))
    ).toBe(true)
  )
  expect(
    view.container.querySelector('[data-slot="build-jewel-stats"]')
  ).toBeNull()
  expect(screen.queryByText("Socket not allocated")).toBeNull()
})
test("unsupported tree versions explain why allocations and totals are unavailable", () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const view = renderJewels("unsupported")
  expect(
    screen
      .getAllByRole("status")
      .every((el) =>
        el.textContent.includes("unavailable for this tree version")
      )
  ).toBe(true)
  expect(
    view.container.querySelector('[data-slot="build-jewel-stats"]')
  ).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
