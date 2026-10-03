// Generates the dithered art assets in public/art and public/og: the masthead
// art for the economy, gems and patch notes headings, the Divine Orb, CSS
// masks, and share card backgrounds. Run with
// `node scripts/dither-art.mjs`. Output is committed; this only needs to run
// again when the palette or the source artwork changes.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

const ORB_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Currency/CurrencyModValues.webp"
const GEM_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Gems/UncutSkillGem.webp"
const SUPPORT_GEM_SOURCE =
  "https://repoe-fork.github.io/poe2/Art/2DItems/Gems/UncutSupportGem.webp"
const PORTRAIT_SOURCE = new URL("./art/patch-notes-source.png", import.meta.url)
const HOODED_SOURCE = new URL(
  "./art/hooded-one-highlighted-source.webp",
  import.meta.url
)
const BUILD_BIN_SOURCE = new URL("./art/build-bin-source.png", import.meta.url)
const ITEMS_SOURCE = new URL(
  "./art/items-character-source.png",
  import.meta.url
)
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
    haloColor = HALO,
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
            ? haloColor
            : PALETTE[0]
      out.set(colour, i)
    }
  }
  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ palette: true })
    .toBuffer()
}

// Keep the generated hood/eye highlights, but render them through the same
// bronze palette and 8×8 Bayer screen as the rest of the site. Native pixels
// are displayed at 2× so the dots remain visible instead of shrinking away.
async function hoodedOneArt() {
  const source = await sharp(await readFile(HOODED_SOURCE))
    .trim()
    .png()
    .toBuffer()
  return mastheadArt(source, {
    width: 160,
    height: 144,
    size: [160, 144],
    left: 0,
    top: 0,
    focus: [0.65, 0.35],
    hold: 0.65,
    gamma: 1.15,
    halo: 0,
  })
}

async function itemsArt() {
  return mastheadArt(await readFile(ITEMS_SOURCE), {
    width: 190,
    height: 100,
    size: [190, 111],
    left: 0,
    top: -5,
    focus: [0.6, 0.5],
    hold: 0.65,
    gamma: 0.85,
    halo: 0,
  })
}

if (process.argv.includes("--items")) {
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL("items-masthead.png", OUT), await itemsArt())
  console.log("wrote public/art/items-masthead.png")
  process.exit(0)
}

// Keep the complete equipment layout, dissolving its frame into the page.
async function buildBinArt() {
  // Separate equipment highlights from the dark panels before quantization.
  const source = await sharp(await readFile(BUILD_BIN_SOURCE))
    .linear(1.3, -20)
    .png()
    .toBuffer()
  return mastheadArt(source, {
    width: 176,
    height: 132,
    size: [176, 132],
    left: 0,
    top: 0,
    focus: [0.5, 0.4],
    hold: 0.6,
    gamma: 0.75,
    halo: 0,
  })
}

if (process.argv.includes("--build-bin")) {
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL("build-bin-masthead.png", OUT), await buildBinArt())
  console.log("wrote public/art/build-bin-masthead.png")
  process.exit(0)
}

if (process.argv.includes("--trees")) {
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL("trees-masthead.png", OUT), await treesMastheadArt())
  console.log("wrote public/art/trees-masthead.png")
  process.exit(0)
}

function treesMastheadArt() {
  return treeArt("atlas-trees/v2/tree.json", {
    subtree: "Breach",
    pad: 160,
    line: 10,
    dot: 24,
    width: 190,
    height: 100,
    hold: 0.6,
    halo: 0.7,
    haloColor: PALETTE[1],
  })
}

// A local-only refresh avoids downloading and rewriting unrelated artwork.
if (process.argv.includes("--hooded-one")) {
  await mkdir(OUT, { recursive: true })
  await writeFile(new URL("hooded-one-masthead.png", OUT), await hoodedOneArt())
  console.log("wrote public/art/hooded-one-masthead.png")
  process.exit(0)
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
await writeFile(new URL("hooded-one-masthead.png", OUT), await hoodedOneArt())
await writeFile(new URL("build-bin-masthead.png", OUT), await buildBinArt())
await writeFile(new URL("items-masthead.png", OUT), await itemsArt())
await writeFile(new URL("trees-masthead.png", OUT), await treesMastheadArt())
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
// Radial glow behind a currency's icon on its page, 184px: the icon's
// halo box (96px frame, 45% bleed each side), brightest at the centre.
await writeFile(
  new URL("glow-icon.png", OUT),
  await ramp(184, 184, 2, (x, y) => {
    const d = Math.hypot(x - 0.5, y - 0.5) * 2
    return Math.max(0, 1 - d) ** 1.4
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
// Skill and support gems each get their uncut gem.
const supportGem = Buffer.from(
  await fetch(SUPPORT_GEM_SOURCE).then((r) => r.arrayBuffer())
)
for (const [name, source] of [
  ["gems-card.png", gem],
  ["support-gems-card.png", supportGem],
])
  await writeFile(
    new URL(`../public/og/${name}`, import.meta.url),
    await ogCard(
      await mastheadArt(source, {
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
// Currency cards draw the item's own art at request time, so their
// background carries only a dithered bronze glow for it to sit on.
function glowArt(width, height, strength) {
  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const d = edgeRadius(x, y, width, height, 0.5, 0.5)
      const tone = strength * ease(1, d) ** 1.5 * (PALETTE.length - 1)
      const level = Math.min(PALETTE.length - 1, Math.floor(tone + bayer(x, y)))
      out.set(PALETTE[level], (y * width + x) * 4)
    }
  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ palette: true })
    .toBuffer()
}
await writeFile(
  new URL("../public/og/currency-card.png", import.meta.url),
  await ogCard(await glowArt(330, 315, 0.5))
)
// Tree cards draw each tree's own line art: connections dim, nodes bright,
// with `view` (tree units, or the nodes' bounds plus `pad`) filling the art
// window; wide trees pad more so their edges stay clear of the title. The ascendancy card adds
// the ring its tree sits in on the passive tree.
async function treeArt(
  path,
  {
    view,
    subtree,
    pad = 300,
    line,
    dot,
    ring,
    width = 330,
    height = 315,
    hold = 0.35,
    halo = 0.6,
    haloColor = HALO,
  }
) {
  const tree = JSON.parse(
    await readFile(new URL(`../public/${path}`, import.meta.url))
  )
  if (subtree) {
    tree.nodes = tree.nodes.filter((node) => node.atlasSubtree === subtree)
    const nodeIds = new Set(tree.nodes.map((node) => node.id))
    tree.edges = tree.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
    )
  }
  const [x, y, w, h] = view ?? fitView(tree.nodes, pad, width / height)
  const radius = (n) => (n.keystone ? dot * 2.2 : n.notable ? dot * 1.5 : dot)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${w} ${h}">
<g fill="none" stroke="rgb(150,150,150)" stroke-width="${line}" stroke-linecap="round">${tree.edges.map((e) => `<path d="${e.path}"/>`).join("")}</g>
${ring ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${ring}" fill="none" stroke="rgb(110,110,110)" stroke-width="${line * 1.5}"/>` : ""}
<g fill="white">${tree.nodes
    .filter((n) => !n.start)
    .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="${radius(n)}"/>`)
    .join("")}</g></svg>`
  return mastheadArt(Buffer.from(svg), {
    width,
    height,
    size: [width, height],
    left: 0,
    top: 0,
    focus: [0.5, 0.5],
    hold,
    gamma: 0.75,
    halo,
    haloColor,
  })
}
// The nodes' bounds plus `pad`, widened to the window's aspect ratio.
function fitView(nodes, pad, aspect) {
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y)
  let x = Math.min(...xs) - pad,
    y = Math.min(...ys) - pad,
    w = Math.max(...xs) + pad - x,
    h = Math.max(...ys) + pad - y
  if (w / h < aspect) {
    x -= (h * aspect - w) / 2
    w = h * aspect
  } else {
    y -= (w / aspect - h) / 2
    h = w / aspect
  }
  return [x, y, w, h]
}
for (const [name, path, options] of [
  // The passive tree is cropped to its middle so its clusters stay legible.
  [
    "passive",
    "pob-trees/passives-v1/0_5.json",
    { view: [-9000, -8600, 18000, 17200], line: 28, dot: 40 },
  ],
  [
    "ascendancies",
    "pob-trees/ascendancies-v1/0_5/oracle.json",
    { line: 10, dot: 28, ring: 1150 },
  ],
  ["atlas", "atlas-trees/v2/tree.json", { pad: 900, line: 24, dot: 50 }],
  ["genesis", "genesis-trees/v1/tree.json", { pad: 1300, line: 28, dot: 65 }],
])
  await writeFile(
    new URL(`../public/og/${name}-tree-card.png`, import.meta.url),
    await ogCard(await treeArt(path, options))
  )
console.log("wrote public/art and public/og")
