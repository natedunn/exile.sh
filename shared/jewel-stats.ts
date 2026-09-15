import type { BuildSnapshot } from "./pob"
import { jewelLines } from "./tree-jewels"
import { equipmentJewelSlots } from "./equipment"

type Item = BuildSnapshot["items"][number]
type Spec = BuildSnapshot["treeSpecs"][number]

/** How a jewel's socket came to be allocated: pathed on the tree, taken
 * within a weapon set, or granted by an item line such as the helmet
 * enchant "Allocates Zarokh's Gift", which lights a socket no path reaches. */
export type SocketAllocation =
  | { kind: "tree" }
  | { kind: "weapon-set"; set: 1 | 2 }
  | { kind: "item"; node: string; item: string }
  | { kind: "equipment"; slot: string }
  | { kind: "none" }

export type SocketedJewel = {
  item: Item
  nodeId: string
  /** The socket is allocated one way or another, so the jewel is in play. */
  active: boolean
  allocation: SocketAllocation
}

const allocates = /^(?:\{[a-z]+\})*Allocates (.+?)\s*$/gim
// Voices: "Allocates 3 Sinister Jewel Sockets" lights that many of the
// unnamed sinister sockets, which no path and no anoint can reach.
const sinisterGrant =
  /^(?:\{[a-z]+\})*Allocates (\d+) Sinister Jewel Sockets?/im
export const SINISTER_SOCKET = "Sinister Jewel Socket"

/** Passive names granted by "Allocates …" lines on the given items, keyed
 * by passive name, with the granting item's name. */
export function grantedAllocations(items: Item[]) {
  const granted = new Map<string, string>()
  for (const item of items)
    for (const match of jewelLines(item).join("\n").matchAll(allocates))
      if (!granted.has(match[1])) granted.set(match[1], item.name)
  return granted
}

/** Jewels socketed in equipment and the selected tree specification. Pass the
 * equipped items and the tree's node names to recognise sockets that items
 * allocate; without them only pathed and weapon-set sockets count. */
export function socketedJewels(
  items: Item[],
  spec?: Spec,
  options: {
    equipped?: Item[]
    nodeNames?: ReadonlyMap<string, string>
    gear?: BuildSnapshot["itemSets"][number]
  } = {}
): SocketedJewel[] {
  const equipmentSockets: SocketedJewel[] = options.gear
    ? equipmentJewelSlots(
        { items, treeSpecs: spec ? [spec] : [] },
        options.gear
      )
        .filter(
          (slot, index, slots) =>
            slots.findIndex((entry) => entry.itemId === slot.itemId) ===
              index &&
            (/\bJewel Socket\s+\d+$/i.test(slot.name) ||
              !spec?.sockets?.some((socket) => socket.itemId === slot.itemId))
        )
        .flatMap((slot) => {
          const item = items.find((entry) => entry.id === slot.itemId)
          return item
            ? [
                {
                  item,
                  nodeId: slot.name,
                  active: true,
                  allocation: { kind: "equipment" as const, slot: slot.name },
                },
              ]
            : []
        })
    : []
  const equipmentIds = new Set(equipmentSockets.map(({ item }) => item.id))
  const pathed = new Set(spec?.nodes ?? [])
  const weaponSets: [Set<string>, Set<string>] = [
    new Set(spec?.weaponSet1 ?? []),
    new Set(spec?.weaponSet2 ?? []),
  ]
  const sockets = (spec?.sockets ?? []).flatMap((socket) => {
    const item = items.find((entry) => entry.id === socket.itemId)
    return item && !equipmentIds.has(item.id)
      ? [{ item, nodeId: socket.nodeId }]
      : []
  })
  // Grants come from equipped items first, then from jewels that are
  // themselves active, so a socketed Megalomaniac can light a socket too.
  const resolve = (
    granted: ReadonlyMap<string, string>,
    sinister: { count: number; item: string }
  ): SocketedJewel[] => {
    let sinisterLeft = sinister.count
    return sockets.map(({ item, nodeId }) => {
      const name = options.nodeNames?.get(nodeId)
      let allocation: SocketAllocation = weaponSets[0].has(nodeId)
        ? { kind: "weapon-set", set: 1 }
        : weaponSets[1].has(nodeId)
          ? { kind: "weapon-set", set: 2 }
          : pathed.has(nodeId)
            ? { kind: "tree" }
            : name && granted.has(name)
              ? { kind: "item", node: name, item: granted.get(name)! }
              : { kind: "none" }
      if (
        allocation.kind === "none" &&
        name === SINISTER_SOCKET &&
        sinisterLeft > 0
      ) {
        sinisterLeft -= 1
        allocation = { kind: "item", node: name, item: sinister.item }
      }
      return { item, nodeId, active: allocation.kind !== "none", allocation }
    })
  }
  const sinisterFrom = (candidates: Item[]) => {
    for (const item of candidates) {
      const match = jewelLines(item).join("\n").match(sinisterGrant)
      if (match) return { count: Number(match[1]), item: item.name }
    }
    return { count: 0, item: "" }
  }
  const fromGear = grantedAllocations(options.equipped ?? [])
  const first = [
    ...equipmentSockets,
    ...resolve(fromGear, sinisterFrom(options.equipped ?? [])),
  ]
  const activeItems = first
    .filter((jewel) => jewel.active)
    .map((jewel) => jewel.item)
  const fromJewels = grantedAllocations(activeItems)
  const sinister = sinisterFrom(activeItems)
  if (!fromJewels.size && !sinister.count) return first
  return [
    ...equipmentSockets,
    ...resolve(new Map([...fromJewels, ...fromGear]), sinister),
  ]
}

const metadata =
  /^(Rarity|Radius|Limited to|Sockets|Quality|Requires|Rune|Soul Core|Corrupted$|-{4,})/i
const markup = /\{[a-z:0-9,]+\}/gi
// Signs stay in the template, so "+10" and "10" never merge.
const number = /\d+(?:\.\d+)?/g

/** A jewel's modifier lines with variants resolved and PoB markup removed. */
export function jewelModifiers(item: Item) {
  const lines = jewelLines(item)
  const rarity = item.rarity.toUpperCase()
  return lines
    .slice(rarity === "RARE" || rarity === "UNIQUE" ? 3 : 2)
    .map((line) => line.replace(markup, "").trim())
    .filter((line) => line && !metadata.test(line))
}

export type JewelStat = {
  /** The line with each number replaced by "#", for display interleaving. */
  template: string
  /** Summed numbers, one per "#" in the template. */
  values: number[]
  /** How many jewel lines contributed. */
  count: number
}

const format = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "")

/** Modifier text with the summed values written back in. */
export function jewelStatText(stat: JewelStat) {
  let index = 0
  return stat.template.replace(/#/g, () => format(stat.values[index++] ?? 0))
}

/** Adds up every modifier across the given jewels. Lines that differ only
 * by their numbers merge, summing each number in place; other lines merge
 * by text and keep a count. Order follows first appearance. */
export function aggregateJewelStats(items: Item[]): JewelStat[] {
  const stats = new Map<string, JewelStat>()
  for (const item of items)
    for (const line of jewelModifiers(item)) {
      const values = Array.from(line.matchAll(number), (m) => Number(m[0]))
      const template = line.replace(number, "#")
      const existing = stats.get(template)
      if (existing) {
        existing.count += 1
        existing.values = existing.values.map((v, i) => v + (values[i] ?? 0))
      } else stats.set(template, { template, values, count: 1 })
    }
  return [...stats.values()]
}
