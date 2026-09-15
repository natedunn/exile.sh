// @vitest-environment jsdom
import { createElement as h } from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  TooltipPinScope,
  PinnablePopoverContent,
} from "../src/components/tooltip-pins"
import { Popover } from "../src/components/ui/popover"

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }))
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function example(enabled = true, limit = 2, resetKey = "first") {
  return h(TooltipPinScope, {
    pinningEnabled: enabled,
    maxPinnedTooltips: limit,
    resetKey,
    children: ["Life", "Mana", "Damage"].map((name) =>
      h(
        Popover,
        { open: true, key: name },
        h(PinnablePopoverContent, {
          showPin: true,
          pinLabel: name,
          onPin() {},
          children: name,
        })
      )
    ),
  })
}
it("can disable pinning and removes existing pins when disabled", async () => {
  const view = render(example(false))
  expect(screen.queryByRole("button", { name: "Pin Life" })).toBeNull()
  view.rerender(example())
  fireEvent.click(await screen.findByRole("button", { name: "Pin Life" }))
  await waitFor(() =>
    expect(
      document.querySelectorAll('[data-tooltip-pinned="true"]')
    ).toHaveLength(1)
  )
  view.rerender(example(false))
  await waitFor(() =>
    expect(
      document.querySelectorAll('[data-tooltip-pinned="true"]')
    ).toHaveLength(0)
  )
})
it("honors a custom limit, replaces the oldest, and clears pins when the view changes", async () => {
  const view = render(example())
  for (const name of ["Life", "Mana", "Damage"])
    fireEvent.click(await screen.findByRole("button", { name: `Pin ${name}` }))
  await waitFor(() =>
    expect(
      document.querySelectorAll('[data-tooltip-pinned="true"]')
    ).toHaveLength(2)
  )
  expect(screen.queryByRole("button", { name: "Close pinned Life" })).toBeNull()
  expect(screen.getByRole("button", { name: "Close pinned Mana" })).toBeTruthy()
  expect(
    screen.getByRole("button", { name: "Close pinned Damage" })
  ).toBeTruthy()
  view.rerender(example(true, 2, "second"))
  await waitFor(() =>
    expect(
      document.querySelectorAll('[data-tooltip-pinned="true"]')
    ).toHaveLength(0)
  )
})

it("keeps a working explicit close control when pinning is disabled", async () => {
  render(
    h(TooltipPinScope, {
      pinningEnabled: false,
      children: h(
        Popover,
        { defaultOpen: true },
        h(PinnablePopoverContent, {
          showPin: true,
          fallbackClose: true,
          pinLabel: "Item details",
          onPin() {},
          children: "Item content",
        })
      ),
    })
  )
  expect(screen.queryByRole("button", { name: "Pin Item details" })).toBeNull()
  fireEvent.click(
    await screen.findByRole("button", { name: "Close Item details" })
  )
  await waitFor(() => expect(screen.queryByText("Item content")).toBeNull())
})
