import { ImageResponse } from "@cf-wasm/og/workerd"
import type { ReactNode } from "react"
import type { CatalogItem } from "../../shared/economy"
import type { GemReference } from "../../shared/gems"
import { ditherPng } from "../../shared/dither"
import type { ItemReference } from "../../shared/item-registry"
import { assetBytes } from "./assets.server"
import { plainDescription } from "./catalog"
import { gemTags } from "./gem-display"
import { pageShares } from "./page-share"
import type { PageShare } from "./page-share"
import { clipText } from "./share-meta"
import { treeShares } from "./tree-share"
import type { TreeShare } from "./tree-share"

/* Share cards (1200 × 630) for the site's pages, drawn with satori over the
 * dithered background from scripts/dither-art.mjs. Colours are the sRGB
 * values of the tokens in tokens.css; satori cannot read CSS variables. */

const colour = {
  paper: "#0c0a07",
  surface: "#14110e",
  ink: "#ede7db",
  inkSoft: "#cbc3b6",
  inkMuted: "#999183",
  brand: "#e1b265",
  brandDeep: "#9b713f",
  rule: "#27231e",
  ruleStrong: "#463e34",
}

async function fonts() {
  const [italic, regular, mono] = await Promise.all([
    assetBytes("/og/fontin-italic.woff"),
    assetBytes("/og/fontin-regular.woff"),
    assetBytes("/og/geist-mono-medium.woff"),
  ])
  return [
    { name: "Fontin", data: italic, weight: 400, style: "italic" },
    { name: "Fontin", data: regular, weight: 400, style: "normal" },
    { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
  ] as const
}

function pngDataUrl(buffer: ArrayBuffer | Uint8Array) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(binary)}`
}

async function background(
  card:
    | "gems-card"
    | "support-gems-card"
    | "currency-card"
    | `${TreeShare}-tree-card`
    | "plain-card"
    | `${(typeof pageShares)[PageShare]["art"]}-card`
) {
  return pngDataUrl(await assetBytes(`/og/${card}.png`))
}

/* A currency's icon, placed over the glow baked into currency-card.png
 * (centred 870px across, 315px down). Icons are small PNGs, mostly
 * 108px, so they scale by a whole number with hard pixels to sit with the
 * dithered ground. Null when the art cannot be fetched. */
type Art = { src: string; width: number; height: number }
async function currencyArt(icon: string): Promise<Art | null> {
  try {
    const response = await fetch(icon.replace(/\.webp$/, ".png"))
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    // PNG width and height live at bytes 16–23 of the IHDR chunk.
    const view = new DataView(buffer)
    const [width, height] = [view.getUint32(16), view.getUint32(20)]
    const scale = Math.max(1, Math.floor(340 / Math.max(width, height)))
    return {
      src: pngDataUrl(buffer),
      width: width * scale,
      height: height * scale,
    }
  } catch {
    return null
  }
}

const mono = {
  fontFamily: "Geist Mono",
  fontSize: 20,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "baseline" }}>
      <span style={{ fontStyle: "normal" }}>exile</span>
      <span style={{ color: colour.brand, fontStyle: "italic" }}>.sh</span>
    </div>
  )
}

/* With `brand`, the title is the wordmark itself, so the corner wordmark and
 * the path below are left out. */
function Card({
  image,
  art,
  label,
  title,
  titleSize,
  tags = [],
  body,
  path,
  brand = false,
}: {
  image: string
  art?: Art | null
  label: string
  title: string
  titleSize: number
  tags?: string[]
  body?: string
  path: string
  brand?: boolean
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: colour.paper,
        backgroundImage: `url(${image})`,
        backgroundSize: "1200px 630px",
        color: colour.ink,
        fontFamily: "Fontin",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // The art starts about 640px in; text stays clear of it.
          width: 640,
          padding: "56px 0 52px 72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 40 }}>
          {!brand && <Wordmark />}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              ...mono,
              display: "flex",
              alignItems: "center",
              color: colour.brand,
            }}
          >
            <span>{label}</span>
            <div
              style={{
                flexGrow: 1,
                height: 1,
                marginLeft: 20,
                backgroundColor: colour.ruleStrong,
              }}
            />
          </div>
          <div
            style={{
              // Satori reads every style value, so absent keys stay absent.
              ...(brand && { display: "flex" }),
              marginTop: 18,
              fontSize: titleSize,
              fontStyle: "italic",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
            }}
          >
            {brand ? <Wordmark /> : title}
          </div>
          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                marginTop: 24,
                gap: 10,
              }}
            >
              {tags.map((tag) => (
                <div
                  key={tag}
                  style={{
                    ...mono,
                    fontSize: 17,
                    padding: "7px 12px 6px",
                    border: `1px solid ${colour.brandDeep}`,
                    backgroundColor: colour.surface,
                    color: colour.brand,
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
          {body && (
            <div
              style={{
                marginTop: 26,
                fontSize: 27,
                lineHeight: 1.4,
                color: colour.inkSoft,
              }}
            >
              {body}
            </div>
          )}
        </div>
        <div
          style={{
            ...mono,
            fontSize: 18,
            textTransform: "none",
            letterSpacing: "0.04em",
            color: colour.inkMuted,
          }}
        >
          {!brand && path}
        </div>
      </div>
      {art && (
        <img
          src={art.src}
          width={art.width}
          height={art.height}
          style={{
            position: "absolute",
            left: 870 - art.width / 2,
            top: 315 - art.height / 2,
            imageRendering: "pixelated",
          }}
        />
      )}
    </div>
  )
}

/** Fontin italic averages about 0.43em per character; the text column is
 * 568px wide. */
const titleLines = (name: string, size: number) =>
  Math.ceil((name.length * size * 0.43) / 568)

/** Title size steps down so long gem names stay on two lines. */
const titleSize = (name: string) =>
  name.length <= 12 ? 100 : name.length <= 17 ? 84 : name.length <= 23 ? 70 : 58

async function render(node: ReactNode) {
  return ImageResponse.async(node, {
    width: 1200,
    height: 630,
    fonts: [...(await fonts())],
    headers: {
      // Cards change only when the gem data or design does; a day in
      // browsers and a week at the edge keeps crawlers fast.
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  })
}

export async function gemCard(gem: GemReference, slug: string) {
  return render(
    <Card
      image={await background(gem.support ? "support-gems-card" : "gems-card")}
      label={gem.support ? "Support gem" : "Skill gem"}
      title={gem.name.replace(/:?\s*\{\d+\}/g, "")}
      titleSize={titleSize(gem.name)}
      tags={gemTags(gem).slice(0, 4)}
      // A wrapped title leaves room for about two lines of description.
      body={
        gem.description
          ? clipText(
              gem.description,
              titleLines(gem.name, titleSize(gem.name)) > 1 ? 95 : 145
            )
          : undefined
      }
      path={`exile.sh/gems/${slug}`}
    />
  )
}

export async function gemsCard(skills: number, supports: number) {
  return render(
    <Card
      image={await background("gems-card")}
      label="Path of Exile 2"
      title="Gems"
      titleSize={132}
      body={`Every skill and support gem: level and quality ranges, effects, requirements and compatible supports. ${skills} skills, ${supports} supports.`}
      path="exile.sh/gems"
    />
  )
}

export async function currencyCard(item: CatalogItem, slug: string) {
  const [image, art] = await Promise.all([
    background("currency-card"),
    currencyArt(item.icon),
  ])
  const size = titleSize(item.name)
  return render(
    <Card
      image={image}
      art={art}
      label={
        item.category === "Currency"
          ? "Currency"
          : `Currency · ${item.category}`
      }
      title={item.name}
      titleSize={size}
      body={
        item.description
          ? clipText(
              plainDescription(item.description),
              titleLines(item.name, size) > 1 ? 95 : 145
            )
          : undefined
      }
      path={`exile.sh/currency/${slug}`}
    />
  )
}

export async function treeCard(tree: TreeShare) {
  const { title, body, path } = treeShares[tree]
  return render(
    <Card
      image={await background(`${tree}-tree-card`)}
      label="Path of Exile 2"
      title={title}
      titleSize={titleSize(title)}
      body={body}
      path={`exile.sh${path}`}
    />
  )
}

export async function pageCard(page: PageShare) {
  const { art, title, body, path } = pageShares[page]
  const brand = page === "default"
  return render(
    <Card
      image={await background(`${art}-card`)}
      label="Path of Exile 2"
      title={title}
      titleSize={brand ? 132 : titleSize(title)}
      body={body}
      path={`exile.sh${path === "/" ? "" : path}`}
      brand={brand}
    />
  )
}

/* An item's own art, dithered to match the cards' ground and drawn at
 * twice its pixels over the art window. Null when the art cannot be
 * fetched or read; the card then falls back to the items artwork. */
async function itemArt(image: string): Promise<Art | null> {
  try {
    const response = await fetch(image.replace(/\.webp$/, ".png"))
    if (!response.ok) return null
    return {
      src: pngDataUrl(ditherPng(await response.arrayBuffer())),
      width: 660,
      height: 630,
    }
  } catch {
    return null
  }
}

export async function itemCard(item: ItemReference) {
  const size = titleSize(item.name)
  const wrapped = titleLines(item.name, size) > 1
  const art = await itemArt(item.image)
  return render(
    <Card
      image={await background(art ? "plain-card" : "items-card")}
      art={art}
      label={
        item.kind === "unique"
          ? `Unique · ${item.baseName}`
          : `Base · ${item.itemClass}`
      }
      title={item.name}
      titleSize={size}
      body={clipText(
        item.kind === "unique"
          ? `A unique ${item.baseName}: its modifiers, variants and roll ranges.`
          : `A ${item.itemClass} base: base stats, implicit modifiers and modifier references.`,
        wrapped ? 95 : 145
      )}
      // Item slugs carry the base name too, too long for one line.
      path="exile.sh/items"
    />
  )
}

/** Serves a card from the edge cache, rendering it once per location. */
export async function cachedCard(
  request: Request,
  draw: () => Promise<Response | null>
) {
  const cache = caches.default
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await draw()
  if (!response) return new Response("Not found", { status: 404 })
  await cache.put(request, response.clone())
  return response
}
