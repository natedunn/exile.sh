import { parseDocument } from "htmlparser2"

export function linesFromHtml(html: string) {
  const document = parseDocument(html)
  const blocks = new Set([
    "p",
    "div",
    "li",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "tr",
    "br",
  ])
  function render(node: any): string {
    if (node.type === "text") return node.data
    const text = (node.children ?? []).map(render).join("")
    return blocks.has(node.name) ? `\n${text}\n` : text
  }
  return document.children
    .map(render)
    .join("")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}
