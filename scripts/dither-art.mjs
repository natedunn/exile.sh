// Generates the dithered art assets in public/art from the Divine Orb icon.
// Run with `node scripts/dither-art.mjs`. Output is committed; this only needs
// to run again when the palette or the source artwork changes.
import { mkdir, writeFile } from "node:fs/promises"
import sharp from "sharp"

const SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Currency/CurrencyModValues.webp"
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

async function ditheredOrb(size, scale) {
  const source = await fetch(SOURCE).then((r) => r.arrayBuffer())
  const { data, info } = await sharp(Buffer.from(source))
    .resize(size, size, { kernel: "lanczos3", fit: "contain" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const a = data[i + 3] / 255
      // Bake the dissolve into the art: a soft rim and a fade toward the
      // bottom, both applied before quantization so the dither carries them.
      const nx = x / (size - 1) - 0.5,
        ny = y / (size - 1) - 0.5
      const rim = Math.min(1, Math.max(0, (1 - Math.hypot(nx, ny) * 2) * 2.4))
      const fade = ny < 0.08 ? 1 : Math.max(0, 1 - ((ny - 0.08) / 0.42) ** 1.3)
      const lum =
        ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) /
          255) *
        a *
        rim *
        fade
      // Lift midtones a little so the orb reads at small opacity.
      const tone = Math.pow(lum, 0.8) * (PALETTE.length - 1)
      const level = Math.min(PALETTE.length - 1, Math.floor(tone + bayer(x, y)))
      const [r, g, b, alpha] = PALETTE[level]
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = alpha
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } })
    .resize(size * scale, size * scale, { kernel: "nearest" })
    .png({ palette: true })
    .toBuffer()
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
await writeFile(new URL("divine-dither.png", OUT), await ditheredOrb(176, 1))
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
