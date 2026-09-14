import type { TreeNode } from "./tree-render-model"

export type NodePaintStyle =
  "unallocated" | "unseen" | "allocated" | "weapon-1" | "weapon-2"
export function nodePaintStyle(
  node: TreeNode,
  allocated: ReadonlySet<string>,
  weaponSets: ReadonlyMap<string, 0 | 1 | 2>
): NodePaintStyle {
  if (!allocated.has(node.id))
    return node.unseenPaths ? "unseen" : "unallocated"
  const set = weaponSets.get(node.id)
  return set ? `weapon-${set}` : "allocated"
}

type Disc = { x: number; y: number; r: number }
/** Start at the same rightmost point as SVG circles, preserving dash phase. */
export function circleSubpath({ x, y, r }: Disc) {
  return `M ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} Z`
}
export function batchTreeDiscs<T extends string>(
  discs: (Disc & { style: T })[]
) {
  const groups = new Map<T, string[]>()
  for (const disc of discs) {
    const path = circleSubpath(disc)
    const paths = groups.get(disc.style)
    if (paths) paths.push(path)
    else groups.set(disc.style, [path])
  }
  return [...groups].map(([style, paths]) => ({
    style,
    path: paths.join(" "),
    count: paths.length,
  }))
}
/** Reorder only non-overlapping paint within a contiguous run. Overlaps start
 * a new run, preserving both stacking order and per-node alpha compositing.
 * Bounds include the world-space extent of non-scaling border strokes.
 */
export function treePaintRuns<T>(items: T[], discOf: (item: T) => Disc) {
  const runs: T[][] = []
  let run: T[] = []
  let bounds: Disc[] = []
  for (const item of items) {
    const disc = discOf(item)
    if (
      bounds.some(
        (other) =>
          Math.abs(other.x - disc.x) <= other.r + disc.r &&
          Math.abs(other.y - disc.y) <= other.r + disc.r
      )
    ) {
      runs.push(run)
      run = []
      bounds = []
    }
    run.push(item)
    bounds.push(disc)
  }
  if (run.length) runs.push(run)
  return runs
}
