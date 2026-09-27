import { ImageResponse } from "@cf-wasm/og/workerd"
import type { ReactNode } from "react"
import type { GemReference } from "../../shared/gems"
import { assetBytes } from "./assets.server"
import { gemTags } from "./gem-display"

/* Share cards (1200 × 630) for the gem pages, drawn with satori over the
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

async function background(support = false) {
  const bytes = new Uint8Array(
    await assetBytes(
      support ? "/og/support-gems-card.png" : "/og/gems-card.png"
    )
  )
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(binary)}`
}

const mono = {
  fontFamily: "Geist Mono",
  fontSize: 20,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const

/** Shortens to `limit` characters, ending on a sentence where one fits
 * and otherwise on a whole word. Line breaks become spaces, since satori
 * drops them without one. */
function clip(text: string, limit: number) {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= limit) return flat
  const cut = flat.slice(0, limit)
  const sentence = cut.lastIndexOf(". ")
  if (sentence > limit * 0.5) return cut.slice(0, sentence + 1)
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`
}

function Card({
  image,
  label,
  title,
  titleSize,
  tags = [],
  body,
  path,
}: {
  image: string
  label: string
  title: string
  titleSize: number
  tags?: string[]
  body?: string
  path: string
}) {
  return (
    <div
      style={{
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
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 40 }}>
          <span>exile</span>
          <span style={{ color: colour.brand, fontStyle: "italic" }}>.sh</span>
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
              marginTop: 18,
              fontSize: titleSize,
              fontStyle: "italic",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
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
          {path}
        </div>
      </div>
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
      image={await background(gem.support)}
      label={gem.support ? "Support gem" : "Skill gem"}
      title={gem.name.replace(/:?\s*\{\d+\}/g, "")}
      titleSize={titleSize(gem.name)}
      tags={gemTags(gem).slice(0, 4)}
      // A wrapped title leaves room for about two lines of description.
      body={
        gem.description
          ? clip(
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
      image={await background()}
      label="Path of Exile 2"
      title="Gems"
      titleSize={132}
      body={`Every skill and support gem: level and quality ranges, effects, requirements and compatible supports. ${skills} skills, ${supports} supports.`}
      path="exile.sh/gems"
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
