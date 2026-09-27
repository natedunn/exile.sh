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
// Oracle's Entwined Realities lets non-keystone passives in Medium radius of
// an allocated keystone be taken without a path. Returns the allocated passives
// that only make sense through it (in such a radius and cut off from the main
// tree) and the keystones whose radius they sit in. Render edges omit class
// starts, so the main tree is the largest connected group of allocated passives.
export function entwinedRealities(
  tree: Node[],
  edges: { from: string; to: string }[],
  allocated: string[]
) {
  const selected = new Set(allocated)
  const radius = radii.Medium * 1.2
  const placed = new Set<string>()
  const centers = new Set<string>()
  const result = { radius, placed, centers }
  if (!tree.some((n) => n.name === "Entwined Realities" && selected.has(n.id)))
    return result
  const keystones = tree.filter((n) => n.keystone && selected.has(n.id))
  if (!keystones.length) return result
  const neighbours = new Map<string, string[]>()
  for (const { from, to } of edges)
    if (selected.has(from) && selected.has(to)) {
      neighbours.set(from, [...(neighbours.get(from) ?? []), to])
      neighbours.set(to, [...(neighbours.get(to) ?? []), from])
    }
  const passives = tree.filter((n) => selected.has(n.id) && !n.ascendancy)
  const seen = new Set<string>()
  let main: string[] = []
  for (const passive of passives) {
    if (seen.has(passive.id)) continue
    const group = [passive.id]
    seen.add(passive.id)
    for (const id of group)
      for (const next of neighbours.get(id) ?? [])
        if (!seen.has(next)) {
          seen.add(next)
          group.push(next)
        }
    if (group.length > main.length) main = group
  }
  const connected = new Set(main)
  for (const n of passives) {
    if (connected.has(n.id) || n.keystone) continue
    for (const k of keystones)
      if (Math.hypot(n.x - k.x, n.y - k.y) <= radius) {
        placed.add(n.id)
        centers.add(k.id)
      }
  }
  return result
}
export type EntwinedRealities = ReturnType<typeof entwinedRealities>
