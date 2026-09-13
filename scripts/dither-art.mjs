// Generates the dithered art assets in public/art: the Divine Orb for the
// economy masthead and the patch notes portrait. Run with
// `node scripts/dither-art.mjs`. Output is committed; this only needs to run
// again when the palette or the source artwork changes.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const ORB_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Currency/CurrencyModValues.webp"
const PORTRAIT_SOURCE = new URL("./art/patch-notes-source.png", import.meta.url)
const OUT = new URL("../public/art/", import.meta.url)

// 8x8 Bayer threshold matrix, normalized to [0, 1).
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
const bayer = (x, y) => BAYER[y % 8][x % 8]

// Bronze ramp: transparent → deep bronze → bronze → pale gold.
const PALETTE = [
  [0, 0, 0, 0],
  [86, 66, 38, 255],
  [176, 138, 82, 255],
  [236, 217, 176, 255],
]

// Quantizes a source image to the bronze ramp with an ordered dither.
// `shape(nx, ny)` returns a 0–1 weight for a pixel at normalized coordinates
// centred on (0, 0); it bakes the dissolve into the art before quantization
// so the dither carries it. `gamma` lifts or sinks the midtones.
async function dithered(input, width, height, { shape, gamma }) {
  const { data } = await sharp(input)
    .resize(width, height, { kernel: "lanczos3", fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3] / 255
      const nx = x / (width - 1) - 0.5,
        ny = y / (height - 1) - 0.5
      const lum =
        ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
          255) *
        a *
        shape(nx, ny)
      const tone = Math.pow(lum, gamma) * (PALETTE.length - 1)
      const level = Math.min(PALETTE.length - 1, Math.floor(tone + bayer(x, y)))
      const [r, g, b, alpha] = PALETTE[level]
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = alpha
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ palette: true })
    .toBuffer()
}

// A soft rim and a fade toward the bottom; the orb reads at small opacity so
// its midtones are lifted a little.
async function ditheredOrb(size) {
  const source = await fetch(ORB_SOURCE).then((r) => r.arrayBuffer())
  return dithered(Buffer.from(source), size, size, {
    gamma: 0.8,
    shape: (nx, ny) => {
      const rim = Math.min(1, Math.max(0, (1 - Math.hypot(nx, ny) * 2) * 2.4))
      const fade = ny < 0.08 ? 1 : Math.max(0, 1 - ((ny - 0.08) / 0.42) ** 1.3)
      return rim * fade
    },
  })
}

// The portrait dissolves at its left edge, where it meets the masthead copy,
// and from the chin down, so the shoulders are gone before the masthead
// rule. Its rendered highlights are brighter than the orb's, so its midtones
// are held rather than lifted. Sized to show at exactly twice its pixels.
async function ditheredPortrait() {
  // Crop the render's empty margins so the figure fills the frame.
  const source = await sharp(await readFile(PORTRAIT_SOURCE))
    .extract({ left: 72, top: 0, width: 184, height: 169 })
    .toBuffer()
  return dithered(source, 138, 127, {
    gamma: 1.05,
    shape: (nx, ny) => {
      const left = Math.min(1, Math.max(0, (nx + 0.5) / 0.3))
      const fade = ny < 0.05 ? 1 : Math.max(0, 1 - ((ny - 0.05) / 0.32) ** 1.4)
      return left * fade
    },
  })
}

// 1-bit dither ramps used as CSS masks. `dot` is the size of each dither cell.
function ramp(width, height, dot, value) {
  const w = Math.ceil(width / dot),
    h = Math.ceil(height / dot)
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = value(x / (w - 1), y / (h - 1)) > bayer(x, y)
      const i = (y * w + x) * 4
      out[i] = out[i + 1] = out[i + 2] = 255
      out[i + 3] = on ? 255 : 0
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .resize(w * dot, h * dot, { kernel: "nearest" })
    .png({ palette: true })
    .toBuffer()
}

await mkdir(OUT, { recursive: true })
// Art is served at its native size or an integer multiple with
// image-rendering: pixelated so the dither cells stay crisp.
await writeFile(new URL("divine-dither.png", OUT), await ditheredOrb(176))
await writeFile(
  new URL("patch-notes-dither.png", OUT),
  await ditheredPortrait()
)
// Masks are used at their native size (mask-size: auto) so the dither cells
// stay crisp; elements that use them are sized to match.
// Top-to-bottom fade, 256px tall, tiled horizontally.
await writeFile(
  new URL("fade-y.png", OUT),
  await ramp(16, 256, 2, (_x, y) => (1 - y) ** 1.3)
)
// Radial glow, 640px, brightest at the centre.
await writeFile(
  new URL("glow.png", OUT),
  await ramp(640, 640, 2, (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5) * 2
    return Math.max(0, 1 - d) ** 1.8
  })
)
console.log("wrote public/art")
