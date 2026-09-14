import type { TreeNode } from "./tree-render-model"

export type SearchableTreeNode = Pick<
  TreeNode,
  "name" | "stats" | "options" | "start"
>
export function treeSearchIndex(nodes: SearchableTreeNode[]) {
  return nodes.flatMap((node, index) =>
    node.start
      ? []
      : [
          {
            index,
            text: [node.name, ...node.stats, ...(node.options ?? [])]
              .join(" ")
              .toLocaleLowerCase(),
          },
        ]
  )
}
export function searchTreeIndex(
  index: ReturnType<typeof treeSearchIndex>,
  query: string
) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return terms.length
    ? index
        .filter((entry) => terms.every((term) => entry.text.includes(term)))
        .map((entry) => entry.index)
    : []
}
