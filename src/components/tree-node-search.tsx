import { startTransition, useEffect, useState } from "react"
import type { TreeNode } from "../../shared/tree-render-model"
import { TreeSearch } from "./tree-search"
import type { TreeSearchOptions } from "./tree-search"
import { useTreeSearch } from "./use-tree-search"

/** Input state stays outside the SVG renderer so typing never redraws the tree. */
export function TreeNodeSearch({
  nodes,
  onResultsChange,
  ...props
}: TreeSearchOptions & {
  nodes: TreeNode[]
  onResultsChange: (results: TreeNode[]) => void
  onSelect: (node: TreeNode) => void
  artwork?: Record<string, string>
}) {
  const [query, setQuery] = useState("")
  const { results, searching } = useTreeSearch(nodes, query)
  useEffect(() => {
    startTransition(() => onResultsChange(results))
  }, [results, onResultsChange])
  return (
    <TreeSearch
      {...props}
      query={query}
      onQueryChange={setQuery}
      results={results}
      searching={searching}
    />
  )
}
