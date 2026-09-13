export type NewsItem = {
  id: string
  title: string
  excerpt: string
  url: string
  date: number
  kind: "patch"
}

export function plainExcerpt(value: string, limit = 260) {
  const text = value
    .replace(/\[(img|previewyoutube|video)[^\]]*\][\s\S]*?\[\/\1\]/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, " ")
    .replace(/\[\/?[^\]]+\]/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
  if (text.length <= limit) return text
  return `${text
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .replace(/[.,;:]+$/, "")}…`
}
