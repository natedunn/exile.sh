import { expect, test } from "vitest"
import { constrainTreeCamera, treeViewport } from "./tree-camera"

test("viewport fits the tree without stretching in wide and tall containers", () => {
  expect(treeViewport(2000, 2)).toEqual({ width: 4000, height: 2000 })
  expect(treeViewport(2000, 0.5)).toEqual({ width: 2000, height: 4000 })
})

test("panning at minimum zoom is allowed", () => {
  const bounds = { x: 0, y: 0, size: 2000 }
  expect(constrainTreeCamera({ ...bounds, x: 250, zoom: 1 }, bounds).x).toBe(
    250
  )
})

test("extreme pan and resize keep a real tree node comfortably visible", () => {
  const bounds = { x: 0, y: 0, size: 2000 }
  const nodes = [
    { x: -800, y: 0 },
    { x: 800, y: 0 },
    { x: 0, y: 800 },
  ]
  for (const aspect of [0.4, 1, 2.5]) {
    for (const zoom of [1, 4, 12]) {
      for (const x of [-999999, 999999]) {
        for (const y of [-999999, 999999]) {
          const camera = constrainTreeCamera(
            { ...bounds, x, y, zoom },
            bounds,
            aspect,
            nodes
          )
          const view = treeViewport(bounds.size / camera.zoom, aspect)
          expect(
            nodes.some(
              (node) =>
                Math.abs(node.x - camera.x) <= view.width * 0.4 + 0.001 &&
                Math.abs(node.y - camera.y) <= view.height * 0.4 + 0.001
            )
          ).toBe(true)
        }
      }
    }
  }
  expect(constrainTreeCamera({ ...bounds, zoom: 0 }, bounds).zoom).toBe(1)
  expect(constrainTreeCamera({ ...bounds, zoom: 100 }, bounds).zoom).toBe(12)
})
