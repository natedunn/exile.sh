export type TreeNode = {
  /** Original PoB ID for switchable ascendancy allocations. */
  baseId?: string
  unseenPaths?: boolean
  id: string
  x: number
  y: number
  name: string
  stats: string[]
  /** Each entry is one choice; newline-separated effects belong to that choice. */
  options?: string[]
  /** Preserve node proportions when embedding an ascendancy in the main tree. */
  renderScale?: number
  notable: boolean
  keystone: boolean
  ascendancy: string
  start: boolean
  icon: string
}
export type TreeData = {
  nodes: TreeNode[]
  edges: { from: string; to: string; path: string }[]
}
export const nodeRadius = (n: TreeNode) =>
  (n.keystone ? 58 : n.notable ? 38 : 23) * (n.renderScale ?? 1)
export const artRadius = (n: TreeNode, socketed = false) =>
  (socketed ? 60 : n.keystone ? 84 : n.notable ? 60 : 45) * (n.renderScale ?? 1)
