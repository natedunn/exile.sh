export type TreeRect = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export function treeRenderRect(
  x: number,
  y: number,
  width: number,
  height: number
): TreeRect {
  return {
    minX: x - width * 0.75 - 100,
    maxX: x + width * 0.75 + 100,
    minY: y - height * 0.75 - 100,
    maxY: y + height * 0.75 + 100,
  }
}
export function containsTreeView(
  rect: TreeRect,
  x: number,
  y: number,
  width: number,
  height: number
) {
  return (
    x - width / 2 >= rect.minX + 60 &&
    x + width / 2 <= rect.maxX - 60 &&
    y - height / 2 >= rect.minY + 60 &&
    y + height / 2 <= rect.maxY - 60
  )
}
export function overlapsTreeRect(a: TreeRect, b: TreeRect) {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  )
}
/** Conservative bounds for our generated line/minor circular-arc paths.
 * The sagitta bounds the arc's deviation from its chord, even when both ends
 * are outside the viewport. Unknown path forms stay visible rather than vanish.
 */
export function treeEdgeBounds(path: string): TreeRect {
  const n = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number) ?? []
  const arc = /^M\s.*\sA\s/.test(path)
  if (!(arc && n.length === 9) && !(/^M\s.*\sL\s/.test(path) && n.length === 4))
    return { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity }
  const [x, y] = n
  const bx = n[n.length - 2],
    by = n[n.length - 1]
  const radius = arc ? Math.max(n[2], Math.hypot(bx - x, by - y) / 2) : 0
  const deviation = radius
    ? radius -
      Math.sqrt(
        Math.max(0, radius * radius - ((bx - x) ** 2 + (by - y) ** 2) / 4)
      )
    : 0
  return {
    minX: Math.min(x, bx) - deviation - 24,
    maxX: Math.max(x, bx) + deviation + 24,
    minY: Math.min(y, by) - deviation - 24,
    maxY: Math.max(y, by) + deviation + 24,
  }
}

/** Fixed world-space regions own each node exactly once. Bounds include the
 * largest artwork/hit target; regions are never clipped at their boundaries.
 * Selecting overlapping regions preserves both their arrays and node objects.
 */
export function treeNodeRegions<T extends { x: number; y: number }>(
  nodes: T[]
) {
  const size = 1200
  const padding = 128
  const regions = new Map<
    string,
    { id: string; nodes: T[]; bounds: TreeRect }
  >()
  for (const node of nodes) {
    const id = `${Math.floor(node.x / size)},${Math.floor(node.y / size)}`
    let region = regions.get(id)
    if (!region) {
      region = {
        id,
        nodes: [],
        bounds: {
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
        },
      }
      regions.set(id, region)
    }
    region.nodes.push(node)
    region.bounds.minX = Math.min(region.bounds.minX, node.x - padding)
    region.bounds.maxX = Math.max(region.bounds.maxX, node.x + padding)
    region.bounds.minY = Math.min(region.bounds.minY, node.y - padding)
    region.bounds.maxY = Math.max(region.bounds.maxY, node.y + padding)
  }
  return [...regions.values()]
}
