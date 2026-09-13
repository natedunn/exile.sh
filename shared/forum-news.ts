import { parseDocument } from "htmlparser2"
import { findAll, findOne, getElementsByTagName, textContent } from "domutils"
import { plainExcerpt } from "./news"
import type { NewsItem } from "./news"

export const PATCH_FORUM = "https://www.pathofexile.com/forum/view-forum/2212"

export function parsePatchForum(html: string): NewsItem[] {
  const document = parseDocument(html)
  const cells = findAll(
    (node) =>
      node.name === "td" &&
      "class" in node.attribs &&
      node.attribs.class.split(/\s+/).includes("thread"),
    document.children
  )
  const items = cells.flatMap((cell) => {
    const titleNode = findOne(
      (node) => node.attribs.class === "title",
      cell.children
    )
    const link = titleNode && getElementsByTagName("a", titleNode.children)[0]
    const dateNode = findOne(
      (node) => node.attribs.class === "post_date",
      cell.children
    )
    const href = link && "href" in link.attribs ? link.attribs.href : ""
    const id = href.match(/^\/forum\/view-thread\/(\d+)$/)?.[1]
    const title = link ? textContent(link).replace(/\s+/g, " ").trim() : ""
    // The forum exposes localized times without an offset. Keep its published
    // calendar date instead of inventing a UTC time or using the last reply date.
    const dateMatch =
      dateNode &&
      textContent(dateNode).match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/)
    if (
      !id ||
      !title ||
      !dateMatch ||
      !/\bpatch notes?\b|\bhotfix\b/i.test(title)
    )
      return []
    const month = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ].indexOf(dateMatch[1])
    if (month < 0) return []
    const date = Date.UTC(Number(dateMatch[3]), month, Number(dateMatch[2]))
    return [
      {
        id: `forum-${id}`,
        title,
        excerpt:
          "Read the full patch notes on the official Path of Exile forum.",
        date,
        url: `https://www.pathofexile.com/forum/view-thread/${id}`,
        kind: "patch" as const,
      },
    ]
  })
  if (!items.length) throw new Error("No patch threads found in forum response")
  return [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) => b.date - a.date
  )
}

export function parsePatchExcerpt(html: string): string {
  const document = parseDocument(html)
  const cell = findOne(
    (node) =>
      node.name === "td" &&
      "class" in node.attribs &&
      node.attribs.class.split(/\s+/).includes("content-container"),
    document.children
  )
  const content =
    cell &&
    findOne(
      (node) =>
        "class" in node.attribs &&
        node.attribs.class.split(/\s+/).includes("content"),
      cell.children
    )
  if (!content) throw new Error("Opening patch post not found")
  // Preserve spaces between list entries without including replies or signatures.
  const paragraphs = getElementsByTagName("li", content.children)
  const text = paragraphs.length
    ? paragraphs.map((node) => textContent(node)).join(" ")
    : textContent(content)
  const excerpt = plainExcerpt(text)
  if (!excerpt) throw new Error("Empty patch post")
  return excerpt
}

const allowedTags = new Set([
  "p",
  "div",
  "span",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "blockquote",
  "pre",
  "code",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
])
const excludedTags = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "svg",
  "math",
])
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export function parsePatchPost(html: string, originalUrl: string) {
  const document = parseDocument(html)
  const forumLink = findOne(
    (node) =>
      node.name === "a" && node.attribs.href === "/forum/view-forum/2212",
    document.children
  )
  // GGG's featured announcements omit both the breadcrumb and the h1.
  const documentTitle = textContent(
    getElementsByTagName("title", document.children).at(0) ?? document
  )
  const announcementTitle = documentTitle.match(
    /^Early Access Patch Notes - (.+) - Forum - Path of Exile$/
  )?.[1]
  const announcement = findOne(
    (node) =>
      node.name === "tr" &&
      "class" in node.attribs &&
      node.attribs.class.split(/\s+/).includes("newsPost"),
    document.children
  )
  if (!forumLink && !(announcementTitle && announcement))
    throw new Error("Thread is not from the PoE2 patch notes forum")
  const titleNode = getElementsByTagName("h1", document.children).at(0)
  const title = titleNode
    ? textContent(titleNode).trim()
    : (announcementTitle ?? "")
  const cell =
    announcement ??
    findOne(
      (node) =>
        node.name === "td" &&
        "class" in node.attribs &&
        node.attribs.class.split(/\s+/).includes("content-container"),
      document.children
    )
  const content =
    cell &&
    findOne(
      (node) =>
        "class" in node.attribs &&
        node.attribs.class.split(/\s+/).includes("content"),
      cell.children
    )
  if (!title || !content || !/\bpatch notes?\b|\bhotfix\b/i.test(title))
    throw new Error("Patch post not found")

  // Rebuild an allowlisted document. Never pass upstream HTML, styles, scripts,
  // event handlers, or unsafe URL protocols through to the browser.
  function render(node: (typeof document.children)[number]): string {
    if (node.type === "text") return escapeHtml(node.data)
    if (!("attribs" in node) || excludedTags.has(node.name)) return ""
    if (/^h[1-6]$/.test(node.name) && textContent(node).trim() === title)
      return ""
    const children = node.children.map(render).join("")
    const tag = node.name === "h1" ? "h2" : node.name
    if (!allowedTags.has(tag)) return children
    let attributes = ""
    if ("id" in node.attribs)
      attributes += ` id="patch-${escapeHtml(node.attribs.id)}"`
    if (tag === "a" && "href" in node.attribs) {
      try {
        const href = node.attribs.href
        const url = new URL(href, originalUrl)
        if (url.protocol === "https:" || url.protocol === "http:") {
          attributes += ` href="${escapeHtml(href.startsWith("#") ? `#patch-${href.slice(1)}` : url.href)}"`
        }
      } catch {
        /* Keep link text when its destination is invalid. */
      }
    }
    if (
      (tag === "td" || tag === "th") &&
      "colspan" in node.attribs &&
      /^\d{1,2}$/.test(node.attribs.colspan)
    )
      attributes += ` colspan="${node.attribs.colspan}"`
    if (
      tag === "ol" &&
      "start" in node.attribs &&
      /^\d{1,4}$/.test(node.attribs.start)
    )
      attributes += ` start="${node.attribs.start}"`
    return `<${tag}${attributes}>${tag === "br" || tag === "hr" ? "" : `${children}</${tag}>`}`
  }
  const body = content.children.map(render).join("")
  if (!body.trim()) throw new Error("Empty patch post")
  return { title, html: body }
}
