export type TreeCamera = { x: number; y: number; zoom: number; size: number }

export function treeViewport(size: number, aspect = 1) {
  return {
    width: size * Math.max(1, aspect),
    height: size * Math.max(1, 1 / aspect),
  }
}

export function constrainTreeCamera(
  camera: TreeCamera,
  bounds: { x: number; y: number; size: number },
  aspect = 1,
  nodes: { x: number; y: number }[] = []
): TreeCamera {
  const zoom = Math.max(1, Math.min(12, camera.zoom))
  const view = treeViewport(bounds.size / zoom, aspect)
  // Allow overscroll, while retaining a useful overlap with the tree.
  const travelX = bounds.size / 2 + view.width / 4
  const travelY = bounds.size / 2 + view.height / 4
  let x = Math.max(bounds.x - travelX, Math.min(bounds.x + travelX, camera.x))
  let y = Math.max(bounds.y - travelY, Math.min(bounds.y + travelY, camera.y))
  // Bounding boxes alone can expose empty corners of the circular tree.
  // Keep at least one real node inside the central 80% of the viewport.
  let correction: { x: number; y: number; distance: number } | undefined
  for (const node of nodes) {
    const dx =
      Math.sign(node.x - x) *
      Math.max(0, Math.abs(node.x - x) - view.width * 0.4)
    const dy =
      Math.sign(node.y - y) *
      Math.max(0, Math.abs(node.y - y) - view.height * 0.4)
    const distance = dx * dx + dy * dy
    if (!correction || distance < correction.distance)
      correction = { x: dx, y: dy, distance }
    if (distance === 0) break
  }
  if (correction) {
    x += correction.x
    y += correction.y
  }
  return { ...camera, zoom, x, y }
}
