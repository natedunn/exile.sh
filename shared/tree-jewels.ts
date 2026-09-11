import type { BuildSnapshot } from "./pob"

type Item = BuildSnapshot["items"][number]
type Node = {
  id: string
  name: string
  x: number
  y: number
  notable: boolean
  keystone?: boolean
  ascendancy: string
  start: boolean
}
// Leading PoB markup such as {desecrated} or {fractured} on a modifier line.
const lineTags = /^(?:\{[a-z]+\})+/i
export function displayLine(line: string) {
  return line.replace(lineTags, "")
}
// "Small/Notable Passive Skills in Radius also grant X": the per-node effect a
// radius jewel adds to passives it covers.
const radiusGrant =
  /^(?:\{[a-z]+\})*(Small|Notable)?\s*Passive Skills in Radius also grant (.+)$/i
export function jewelLines(item: Item) {
  const selected = new Set([
    ...(item.selectedVariants || []),
    ...Array.from(
      item.text.matchAll(
        /^Selected (?:Alt )?Variant(?: Two| Three)?:\s*(\d+)/gm
      ),
      (m) => m[1]
    ),
  ])
  return item.text
    .split(/\r?\n/)
    .map((line) => {
      const tag = line.match(/\{variant:([\d,]+)\}/)
      if (tag && !tag[1].split(",").some((id) => selected.has(id))) return ""
      return line.replace(/\{variant:[\d,]+\}/g, "").trim()
    })
    .filter(
      (line) =>
        line &&
        !/^(Variant|Selected .*Variant|Has Alt Variant|Unique ID|Item Level|LevelReq|Implicits):/.test(
          line
        )
    )
}
const rings: Record<string, [number, number]> = {
  "Very Small": [650, 950],
  Small: [800, 1100],
  "Medium-Small": [950, 1250],
  Medium: [1100, 1400],
  "Medium-Large": [1250, 1550],
  Large: [1400, 1700],
  "Very Large": [1650, 1950],
  Massive: [1800, 2100],
}
const radii: Record<string, number> = {
  Small: 1000,
  Medium: 1150,
  Large: 1300,
  "Very Large": 1500,
}
export function treeJewels(
  tree: Node[],
  sockets: { nodeId: string; itemId: string }[],
  items: Item[],
  allocated: string[]
) {
  const selected = new Set(allocated)
  return sockets.flatMap((socket) => {
    const item = items.find((i) => i.id === socket.itemId)
    const origin = tree.find((n) => n.id === socket.nodeId)
    if (!item || !origin) return []
    const lines = jewelLines(item),
      text = lines.join(" ")
    const name = item.name
    const radiusLabel =
      lines
        .find((l) => l.startsWith("Radius:"))
        ?.slice(7)
        .trim() || ""
    const ring = text.match(
      /Only affects Passives in (Very Small|Medium-Small|Medium-Large|Very Large|Small|Medium|Large|Massive) Ring/i
    )
    const radius = ring
      ? rings[
          Object.keys(rings).find(
            (k) => k.toLowerCase() === ring[1].toLowerCase()
          )!
        ]
      : [0, radii[radiusLabel] || 0]
    // These PoB versions share the 0_1 radii and a 1.2 distance multiplier.
    const inner = radius[0] * 1.2,
      outer = radius[1] * 1.2
    const centers =
      name === "From Nothing"
        ? [
            ...text.matchAll(/Passives in radius of (.+?) can be Allocated/gi),
          ].flatMap((match) => {
            const center = tree.find(
              (n) => n.name.toLowerCase() === match[1].toLowerCase()
            )
            return center ? [center] : []
          })
        : [origin]
    const active = selected.has(origin.id)
    const grants = active
      ? lines.flatMap((line) => {
          const grantedName = line.replace(/^Allocates /, "")
          const granted = tree.find(
            (node) =>
              node.name === grantedName && node.notable && !node.ascendancy
          )
          return granted ? [granted.id] : []
        })
      : []
    const areas =
      active && outer
        ? centers.map((center) => ({
            x: center.x,
            y: center.y,
            inner,
            outer,
            centerId: center.id,
            affected: tree
              .filter((n) => {
                const distance = Math.hypot(n.x - center.x, n.y - center.y)
                return (
                  !n.start &&
                  !n.ascendancy &&
                  n.id !== center.id &&
                  n.name !== "Jewel Socket" &&
                  distance >= inner &&
                  distance <= outer
                )
              })
              .map((n) => n.id),
          }))
        : []
    const timeless = name === "Heroic Tragedy" || name === "Undying Hate"
    const radiusGrants = lines.flatMap((line) => {
      const match = line.match(radiusGrant)
      return match
        ? [
            {
              scope: (match[1] ? match[1].toLowerCase() : "all") as
                "small" | "notable" | "all",
              effect: match[2].trim(),
            },
          ]
        : []
    })
    return [
      {
        item,
        grants,
        lines,
        radiusGrants,
        origin,
        areas,
        active,
        timeless,
        warning: timeless
          ? "Seeded passive transformations are not calculated here. Open in PoB for the conquered node effects."
          : name === "From Nothing" && !centers.length
            ? "The named keystone could not be resolved for this tree."
            : radiusLabel && !outer
              ? "This jewel's radius could not be resolved from the export."
              : "",
      },
    ]
  })
}
export type TreeJewel = ReturnType<typeof treeJewels>[number]
// The extra lines a passive gains from sitting inside a jewel's radius.
// Keystones are neither small nor notable passives, so they gain nothing.
export function radiusBenefits(
  jewel: TreeJewel,
  node: { notable: boolean; keystone?: boolean }
) {
  if (node.keystone) return []
  return jewel.radiusGrants
    .filter(
      (grant) =>
        grant.scope === "all" || (grant.scope === "notable") === node.notable
    )
    .map((grant) => grant.effect)
}
