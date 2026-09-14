export type ConnectionStyle =
  "unallocated" | "unseen" | "allocated" | "weapon-1" | "weapon-2"

/** Each connection remains an independent M… subpath, preserving its arcs and
 * round caps. Only connections with identical stroke treatment are combined. */
export function batchTreeConnections(
  edges: readonly { from: string; to: string; path: string }[],
  selected: ReadonlySet<string>,
  weaponSets: ReadonlyMap<string, 0 | 1 | 2>,
  unseen: ReadonlySet<string>
) {
  const groups = new Map<ConnectionStyle, string[]>()
  for (const edge of edges) {
    const allocated = selected.has(edge.from) && selected.has(edge.to)
    const weapon = weaponSets.get(edge.from) || weaponSets.get(edge.to) || 0
    const style: ConnectionStyle = allocated
      ? weapon === 1
        ? "weapon-1"
        : weapon === 2
          ? "weapon-2"
          : "allocated"
      : unseen.has(edge.from) || unseen.has(edge.to)
        ? "unseen"
        : "unallocated"
    const paths = groups.get(style)
    if (paths) paths.push(edge.path)
    else groups.set(style, [edge.path])
  }
  return Array.from(groups, ([style, paths]) => ({
    style,
    path: paths.join(" "),
    count: paths.length,
  }))
}
