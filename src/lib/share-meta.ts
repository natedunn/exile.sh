/** The public origin, without a trailing slash, for absolute share URLs. */
export const siteUrl = (
  import.meta.env.VITE_SITE_URL || "https://exile.sh"
).replace(/\/$/, "")

/** Shortens to `limit` characters, ending on a sentence where one fits
 * and otherwise on a whole word. Whitespace runs collapse to one space. */
export function clipText(text: string, limit: number) {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= limit) return flat
  const cut = flat.slice(0, limit)
  const sentence = cut.lastIndexOf(". ")
  if (sentence > limit * 0.5) return cut.slice(0, sentence + 1)
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}…`
}

/** Title, description, canonical link and Open Graph / Twitter card tags
 * for a page. `path` and `image` are site-relative. */
export function shareMeta({
  title,
  description,
  path,
  image,
}: {
  title: string
  description: string
  path: string
  image?: string
}) {
  const url = `${siteUrl}${path}`
  // Keep summaries concise; search engines may choose a different snippet.
  const summary = clipText(description, 155)
  return {
    meta: [
      { title: title.startsWith("exile.sh:") ? title : `${title} · exile.sh` },
      { name: "description", content: summary },
      { property: "og:title", content: title },
      { property: "og:description", content: summary },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      ...(image
        ? [
            { property: "og:image", content: `${siteUrl}${image}` },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : [{ name: "twitter:card", content: "summary" }]),
    ],
    links: [{ rel: "canonical", href: url }],
  }
}
