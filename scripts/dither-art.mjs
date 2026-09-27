// Generates the dithered art assets in public/art: the masthead art for the
// economy, gems and patch notes headings, the Divine Orb, and CSS masks. Run with
// `node scripts/dither-art.mjs`. Output is committed; this only needs to run
// again when the palette or the source artwork changes.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const ORB_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Currency/CurrencyModValues.webp"
const GEM_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Gems/UncutSkillGem.webp"
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

// 0 at `edge`, 1 at 0, easing between; used to thin dither density.
const ease = (edge, v) => {
  const t = Math.min(1, Math.max(0, v / edge))
  return 1 - t * t * (3 - 2 * t)
}

// Distance from a focus point, scaled separately toward each edge of a
// w × h window so it reaches 1 exactly at every edge: an off-centre ellipse
// that fills the window.
function edgeRadius(x, y, w, h, fx, fy) {
  const cx = fx * (w - 1),
    cy = fy * (h - 1)
  const dx = (x - cx) / (x < cx ? cx : w - 1 - cx)
  const dy = (y - cy) / (y < cy ? cy : h - 1 - cy)
  return Math.hypot(dx, dy)
}

// Masthead art. The source is placed where the header shows it and cropped
// to that window, then dissolved radially from `focus` to nothing at every
// edge before quantization, so the dither thins out instead of the header
// clipping a flat edge. A faint halo is dithered underneath in the same
// falloff. Served at exactly twice its pixels.
const HALO = [176, 138, 82, 44]
async function mastheadArt(
  input,
  {
    width,
    height,
    size,
    left,
    top,
    focus = [0.6, 0.5],
    hold = 0.3,
    gamma,
    halo = 0.5,
  }
) {
  // Pad the resized source so the window may reach past its edges.
  const pad = Math.max(width, height)
  const padded = await sharp(input)
    .resize(size[0], size[1], {
      kernel: "lanczos3",
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const placed = await sharp(padded)
    .extract({ left: pad - left, top: pad - top, width, height })
    .raw()
    .toBuffer()
  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const d = edgeRadius(x, y, width, height, focus[0], focus[1])
      // Full strength inside `hold`, easing to zero at the window's edge.
      const fade = d <= hold ? 1 : ease(1 - hold, d - hold)
      const a = placed[i + 3] / 255
      const lum =
        ((0.2126 * placed[i] +
          0.7152 * placed[i + 1] +
          0.0722 * placed[i + 2]) /
          255) *
        a *
        fade
      const tone = Math.pow(lum, gamma) * (PALETTE.length - 1)
      const level = Math.min(PALETTE.length - 1, Math.floor(tone + bayer(x, y)))
      const colour =
        level > 0
          ? PALETTE[level]
          : halo * ease(1, d) ** 1.6 > bayer(x + 3, y + 5)
            ? HALO
            : PALETTE[0]
      out.set(colour, i)
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } })
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
// Masthead windows are 190 × 100 (380 × 200 CSS px, the heading's height).
const orb = Buffer.from(await fetch(ORB_SOURCE).then((r) => r.arrayBuffer()))
const gem = Buffer.from(await fetch(GEM_SOURCE).then((r) => r.arrayBuffer()))
await writeFile(
  new URL("economy-masthead.png", OUT),
  await mastheadArt(orb, {
    width: 190,
    height: 100,
    size: [170, 170],
    left: 28,
    top: -38,
    focus: [0.62, 0.45],
    gamma: 0.8,
  })
)
await writeFile(
  new URL("gems-masthead.png", OUT),
  await mastheadArt(gem, {
    width: 190,
    height: 100,
    size: [170, 170],
    left: 28,
    top: -38,
    focus: [0.62, 0.5],
    gamma: 0.75,
  })
)
// The portrait keeps its native pixels; the face sits right of centre.
const portrait = await sharp(await readFile(PORTRAIT_SOURCE))
  .extract({ left: 72, top: 0, width: 184, height: 169 })
  .toBuffer()
await writeFile(
  new URL("patch-notes-masthead.png", OUT),
  await mastheadArt(portrait, {
    width: 170,
    height: 100,
    size: [138, 127],
    left: 28,
    top: -3,
    focus: [0.58, 0.42],
    hold: 0.25,
    gamma: 1.05,
  })
)
// Art is served at its native size or an integer multiple with
// image-rendering: pixelated so the dither cells stay crisp.
await writeFile(new URL("divine-dither.png", OUT), await ditheredOrb(176))
// Masks are used at their native size (mask-size: auto) so the dither cells
// stay crisp; elements that use them are sized to match.
// Top-to-bottom fade, 256px tall, tiled horizontally.
await writeFile(
  new URL("fade-y.png", OUT),
  await ramp(16, 256, 2, (_x, y) => (1 - y) ** 1.3)
)
// Masthead glow for art that is not baked, 640 × 200: densest right of
// centre and thinning to nothing at every edge.
await writeFile(
  new URL("glow-masthead.png", OUT),
  await ramp(640, 200, 2, (x, y) => {
    // ramp() passes 0–1 coordinates: a 2 × 2 window maps them 1:1.
    const d = edgeRadius(x, y, 2, 2, 0.68, 0.5)
    return ease(1, d) ** 1.3
  })
)
// Radial glow, 640px, brightest at the centre.
await writeFile(
  new URL("glow.png", OUT),
  await ramp(640, 640, 2, (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5) * 2
    return Math.max(0, 1 - d) ** 1.8
  })
)
// Share card for /gems pages, 1200 × 630: the paper ground with the site's
// faint dot grid, and the uncut gem dissolving into it on the right. Built
// at half size and doubled, so dither cells stay crisp without relying on
// the renderer's scaling. Text is drawn over it by src/lib/og.tsx.
const PAPER = [12, 10, 7, 255]
const GRID = [39, 35, 30, 255]
async function ogCard(art) {
  const width = 600,
    height = 315
  const ground = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      ground.set(
        x % 14 === 6 && y % 14 === 6 ? GRID : PAPER,
        (y * width + x) * 4
      )
  const card = await sharp(ground, { raw: { width, height, channels: 4 } })
    .composite([{ input: art, left: width - 330, top: 0 }])
    .png()
    .toBuffer()
  return sharp(card)
    .resize(width * 2, height * 2, { kernel: "nearest" })
    .png({ palette: true })
    .toBuffer()
}
await mkdir(new URL("../public/og/", import.meta.url), { recursive: true })
await writeFile(
  new URL("../public/og/gems-card.png", import.meta.url),
  await ogCard(
    await mastheadArt(gem, {
      width: 330,
      height: 315,
      size: [290, 290],
      left: 40,
      top: 12,
      focus: [0.55, 0.5],
      hold: 0.35,
      gamma: 0.75,
      halo: 0.6,
    })
  )
)
console.log("wrote public/art and public/og")
