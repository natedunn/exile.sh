import { decode, encode } from "fast-png"
import { expect, test } from "vitest"
import { ditherPng } from "./dither"

// A 40 × 60 white bar on a transparent ground, like a tall item.
function bar() {
  const data = new Uint8Array(40 * 60 * 4)
  for (let i = 0; i < data.length; i += 4) data.set([255, 255, 255, 255], i)
  return encode({ width: 40, height: 60, data, channels: 4, depth: 8 }).buffer
}

test("dithers art into the card window using only the bronze ramp", () => {
  const out = decode(ditherPng(bar() as ArrayBuffer))
  expect([out.width, out.height, out.channels]).toEqual([330, 315, 4])
  const colours = new Set<string>()
  for (let i = 0; i < out.data.length; i += 4)
    colours.add(Array.from(out.data.slice(i, i + 4)).join())
  expect([...colours].sort()).toEqual(
    [
      "0,0,0,0",
      "176,138,82,44",
      "86,66,38,255",
      "176,138,82,255",
      "236,217,176,255",
    ].sort()
  )
})

test("fits the art inside the box, centred, and clears the corners", () => {
  const out = decode(ditherPng(bar() as ArrayBuffer))
  const alpha = (x: number, y: number) => out.data[(y * 330 + x) * 4 + 3]
  // The bar is scaled to 270px tall: 180 × 270, centred.
  expect(alpha(165, 157)).toBe(255)
  expect(alpha(0, 0)).toBe(0)
  expect(alpha(329, 314)).toBe(0)
})
