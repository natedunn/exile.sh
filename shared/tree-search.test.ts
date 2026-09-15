// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { TreeSearch } from "../src/components/tree-search"
import type { TreeNode } from "./tree-render-model"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("keeps manual search available when the shortcut and result list are disabled", () => {
  const onSelect = vi.fn()
  const view = render(
    createElement(TreeSearch, {
      query: "life",
      onQueryChange: vi.fn(),
      results: [
        { id: "1", name: "Life", stats: ["Increased life"] } as TreeNode,
      ],
      onSelect,
      searchHotkey: false,
      showSearchResults: false,
    })
  )
  const trigger = view.getByRole("button", { name: "Search tree" })
  fireEvent.keyDown(document, { key: "f" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(trigger.hasAttribute("aria-keyshortcuts")).toBe(false)
  fireEvent.click(trigger)
  expect(document.activeElement).toBe(view.getByRole("textbox"))
  expect(view.getByRole("status").textContent).toBe("1 matching node")
  expect(view.queryByRole("list")).toBeNull()
  fireEvent.keyDown(view.getByRole("textbox"), { key: "Escape" })
  expect(document.activeElement).toBe(trigger)
  expect(onSelect).not.toHaveBeenCalled()
})

it.each([false, true])(
  "navigates results and closes after selection only on mobile: %s",
  (mobile) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: mobile }))
    )
    const onSelect = vi.fn()
    const results = [
      { id: "1", name: "First", stats: [] },
      { id: "2", name: "Second", stats: [] },
      { id: "3", name: "Third", stats: [] },
    ] as unknown as TreeNode[]
    const view = render(
      createElement(TreeSearch, {
        query: "node",
        onQueryChange: vi.fn(),
        results,
        onSelect,
      })
    )
    fireEvent.click(view.getByRole("button", { name: "Search tree" }))
    const input = view.getByRole("textbox")
    const first = view.getByRole("button", { name: "First" })
    const last = view.getByRole("button", { name: "Third" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: "ArrowUp" })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: "Home" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: "ArrowDown" })
    expect(document.activeElement).toBe(
      view.getByRole("button", { name: "Second" })
    )
    fireEvent.keyDown(document.activeElement!, { key: "End" })
    expect(document.activeElement).toBe(last)
    fireEvent.click(last)
    expect(onSelect).toHaveBeenCalledWith(results[2])
    if (mobile) {
      expect(document.activeElement).toBe(
        view.getByRole("button", { name: "Search tree" })
      )
    } else {
      expect(document.activeElement).toBe(last)
      expect(view.getByRole("textbox")).toBe(input)
    }
  }
)
