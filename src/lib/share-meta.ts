/** The public origin, without a trailing slash, for absolute share URLs. */
export const siteUrl = (
  import.meta.env.VITE_SITE_URL || "https://exile.sh"
).replace(/\/$/, "")

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
  image: string
}) {
  const url = `${siteUrl}${path}`
  return {
    meta: [
      { title: `${title} · exile.sh` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: `${siteUrl}${image}` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: url }],
  }
}
