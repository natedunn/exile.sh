import type { TreeData } from "./tree-render-model"

export type TreeBackground = {
  image: string
  x: number
  y: number
  width: number
  height: number
}

export const CENTER_ART_RADIUS = 1440
export const CENTER_RADIUS = CENTER_ART_RADIUS

/** Fit a separately loaded ascendancy inside the passive tree's central circle. */
export function centerAscendancy(
  tree: TreeData,
  background?: TreeBackground
): TreeData {
  const xs = tree.nodes.map((node) => node.x)
  const ys = tree.nodes.map((node) => node.y)
  const x = background?.x ?? (Math.min(...xs) + Math.max(...xs)) / 2
  const y = background?.y ?? (Math.min(...ys) + Math.max(...ys)) / 2
  const size = Math.max(
    background?.width ?? 0,
    background?.height ?? 0,
    ...tree.nodes.map(
      (node) => Math.max(Math.abs(node.x - x), Math.abs(node.y - y)) * 2 + 180
    )
  )
  const scale = (CENTER_ART_RADIUS * 2) / size
  const tx = (value: string) => (Number(value) - x) * scale
  const ty = (value: string) => (Number(value) - y) * scale
  return {
    nodes: tree.nodes.map((node) => ({
      ...node,
      id: "center:" + node.id,
      renderScale: scale,
      x: (node.x - x) * scale,
      y: (node.y - y) * scale,
    })),
    edges: tree.edges.map((edge) => ({
      from: "center:" + edge.from,
      to: "center:" + edge.to,
      path: edge.path
        .replace(
          /([ML])\s+([-\d.e]+)\s+([-\d.e]+)/g,
          (_, command, px, py) => `${command} ${tx(px)} ${ty(py)}`
        )
        .replace(
          /A\s+([-\d.e]+)\s+([-\d.e]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([-\d.e]+)\s+([-\d.e]+)/g,
          (_, rx, ry, rotation, large, sweep, px, py) =>
            `A ${Number(rx) * scale} ${Number(ry) * scale} ${rotation} ${large} ${sweep} ${tx(px)} ${ty(py)}`
        ),
    })),
  }
}
