import { convertIndexedToRgb, decode, encode } from "fast-png"

/* Request-time counterpart to scripts/dither-art.mjs: renders item art
 * through the same bronze ramp and 8×8 Bayer screen, dissolving into a
 * faint halo, so share cards can show any item without a build step. The
 * constants mirror the script's; change them together. */

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((v) => (v + 0.5) / 64))
const bayer = (x: number, y: number) => BAYER[y % 8][x % 8]

const PALETTE = [
  [0, 0, 0, 0],
  [86, 66, 38, 255],
  [176, 138, 82, 255],
  [236, 217, 176, 255],
]
const HALO = [176, 138, 82, 44]

// 0 at `edge`, 1 at 0, easing between.
const ease = (edge: number, v: number) => {
  const t = Math.min(1, Math.max(0, v / edge))
  return 1 - t * t * (3 - 2 * t)
}

// Distance from a focus point, reaching 1 exactly at every window edge.
function edgeRadius(
  x: number,
  y: number,
  w: number,
  h: number,
  fx: number,
  fy: number
) {
  const cx = fx * (w - 1),
    cy = fy * (h - 1)
  const dx = (x - cx) / (x < cx ? cx : w - 1 - cx)
  const dy = (y - cy) / (y < cy ? cy : h - 1 - cy)
  return Math.hypot(dx, dy)
}

/** Each pixel's luminance times its alpha, 0–1, from any 8- or 16-bit PNG. */
function coverage(png: ArrayBuffer) {
  const image = decode(png)
  const data = image.palette ? convertIndexedToRgb(image) : image.data
  const channels = image.palette ? (image.transparency ? 4 : 3) : image.channels
  const max = image.depth === 16 && !image.palette ? 65535 : 255
  const values = new Float32Array(image.width * image.height)
  for (let i = 0; i < values.length; i++) {
    const p = i * channels
    const [r, g, b] =
      channels < 3 ? [data[p], data[p], data[p]] : data.slice(p, p + 3)
    const a = channels === 2 || channels === 4 ? data[p + channels - 1] : max
    values[i] = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / max) * (a / max)
  }
  return { width: image.width, height: image.height, values }
}

/** Bilinear sample of `values` at a fractional source position. */
function sample(
  { width, height, values }: ReturnType<typeof coverage>,
  sx: number,
  sy: number
) {
  if (sx < -0.5 || sy < -0.5 || sx > width - 0.5 || sy > height - 0.5) return 0
  const x = Math.min(width - 1, Math.max(0, sx)),
    y = Math.min(height - 1, Math.max(0, sy))
  const x0 = Math.floor(x),
    y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1),
    y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0,
    fy = y - y0
  const top = values[y0 * width + x0] * (1 - fx) + values[y0 * width + x1] * fx
  const bottom =
    values[y1 * width + x0] * (1 - fx) + values[y1 * width + x1] * fx
  return top * (1 - fy) + bottom * fy
}

/** Dithers a PNG into a `width` × `height` window, fitted inside `box`
 * around the window's centre, and returns it as a PNG. Brightness is
 * levelled so dark and bright art reach the same ramp. Served at twice its
 * pixels, as the script's cards are. */
export function ditherPng(
  png: ArrayBuffer,
  {
    width = 330,
    height = 315,
    box = 270,
    hold = 0.35,
    gamma = 0.85,
    halo = 0.6,
  } = {}
) {
  const source = coverage(png)
  const scale = box / Math.max(source.width, source.height)
  const left = (width - source.width * scale) / 2,
    top = (height - source.height * scale) / 2
  // The brightest 2% of covered pixels set full brightness.
  const lit = Array.from(source.values)
    .filter((v) => v > 0.02)
    .sort((a, b) => a - b)
  const peak = Math.max(0.2, lit[Math.floor(lit.length * 0.98)] ?? 1)
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const d = edgeRadius(x, y, width, height, 0.5, 0.5)
      const fade = d <= hold ? 1 : ease(1 - hold, d - hold)
      const value = sample(
        source,
        (x + 0.5 - left) / scale - 0.5,
        (y + 0.5 - top) / scale - 0.5
      )
      const lum = Math.min(1, value / peak) * fade
      const tone = Math.pow(lum, gamma) * (PALETTE.length - 1)
      const level = Math.min(PALETTE.length - 1, Math.floor(tone + bayer(x, y)))
      out.set(
        level > 0
          ? PALETTE[level]
          : halo * ease(1, d) ** 1.6 > bayer(x + 3, y + 5)
            ? HALO
            : PALETTE[0],
        (y * width + x) * 4
      )
    }
  return encode({ width, height, data: out, channels: 4, depth: 8 })
}
