import {
  searchTreeIndex,
  treeSearchIndex,
} from "../../shared/tree-search-index"
import type { SearchableTreeNode } from "../../shared/tree-search-index"

let index: ReturnType<typeof treeSearchIndex> = []
self.onmessage = (
  event: MessageEvent<{
    nodes?: SearchableTreeNode[]
    query: string
    request: number
  }>
) => {
  if (event.data.nodes) index = treeSearchIndex(event.data.nodes)
  self.postMessage({
    request: event.data.request,
    indices: searchTreeIndex(index, event.data.query),
  })
}
