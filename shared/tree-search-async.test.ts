// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useTreeSearch } from "../src/components/use-tree-search"
import { searchTreeIndex, treeSearchIndex } from "./tree-search-index"
import type { TreeNode } from "./tree-render-model"

const nodes = [
  {
    name: "Life",
    stats: ["Increased maximum Life"],
    options: [],
    start: false,
  },
  {
    name: "Damage",
    stats: [],
    options: ["Increased Fire Damage"],
    start: false,
  },
  { name: "Start", stats: ["Increased Life"], start: true },
] as TreeNode[]
class SearchWorker {
  static instances: SearchWorker[] = []
  onmessage?: (event: { data: { request: number; indices: number[] } }) => void
  onerror?: () => void
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    SearchWorker.instances.push(this)
  }
  respond(request: number, indices: number[]) {
    this.onmessage?.({ data: { request, indices } })
  }
}
beforeEach(() => {
  SearchWorker.instances = []
  vi.stubGlobal("Worker", SearchWorker)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("indexes names, stats and options once, excluding start nodes and empty queries", () => {
  const index = treeSearchIndex(nodes)
  expect(searchTreeIndex(index, "  LIFE increased ")).toEqual([0])
  expect(searchTreeIndex(index, "fire DAMAGE")).toEqual([1])
  expect(searchTreeIndex(index, " ")).toEqual([])
})
it("starts lazily, retains results while searching and rejects outdated replies", async () => {
  const { result, rerender, unmount } = renderHook(
    ({ query }) => useTreeSearch(nodes, query),
    { initialProps: { query: "" } }
  )
  expect(SearchWorker.instances).toHaveLength(0)
  rerender({ query: "life" })
  const worker = SearchWorker.instances[0]
  const first = worker.postMessage.mock.calls[0][0]
  expect(first.nodes).toHaveLength(3)
  expect(result.current.searching).toBe(true)
  act(() => worker.respond(first.request, [0]))
  await waitFor(() => expect(result.current.results).toEqual([nodes[0]]))
  rerender({ query: "fire" })
  const second = worker.postMessage.mock.calls[1][0]
  expect(second.nodes).toBeUndefined()
  expect(result.current.searching).toBe(true)
  expect(result.current.results).toEqual([nodes[0]])
  rerender({ query: "damage" })
  const third = worker.postMessage.mock.calls[2][0]
  act(() => worker.respond(second.request, [0]))
  expect(result.current.searching).toBe(true)
  act(() => worker.respond(third.request, [1]))
  await waitFor(() => expect(result.current.results).toEqual([nodes[1]]))
  rerender({ query: "" })
  act(() => worker.respond(third.request, [1]))
  expect(result.current.results).toEqual([])
  expect(result.current.searching).toBe(false)
  unmount()
  expect(worker.terminate).toHaveBeenCalled()
})
it("falls back to yielding batches if the worker cannot start", async () => {
  vi.stubGlobal("Worker", undefined)
  const { result } = renderHook(() => useTreeSearch(nodes, "fire"))
  await waitFor(() => expect(result.current.searching).toBe(false))
  expect(result.current.results).toEqual([nodes[1]])
})
