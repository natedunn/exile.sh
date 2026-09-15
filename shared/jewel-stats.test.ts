import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { parseBuild } from "./pob"
import {
  aggregateJewelStats,
  grantedAllocations,
  jewelModifiers,
  jewelStatText,
  socketedJewels,
} from "./jewel-stats"

const fixture = (name: string) =>
  parseBuild(
    readFileSync(
      new URL("./fixtures/pob/" + name + ".txt", import.meta.url),
      "utf8"
    )
  )

test("socketed jewels follow the tree specification's sockets", () => {
  const build = fixture("2k0EPn6QOhTx")
  const spec = build.treeSpecs[build.activeSpec]
  const jewels = socketedJewels(build.items, spec)
  expect(jewels.map((jewel) => jewel.item.name)).toContain("Prism of Belief")
  expect(jewels.every((jewel) => jewel.active)).toBe(true)
  expect(socketedJewels(build.items, undefined)).toEqual([])
})

test("jewel modifiers drop metadata and markup", () => {
  const build = fixture("2k0EPn6QOhTx")
  const prism = build.items.find((item) => item.name === "Prism of Belief")!
  const lines = jewelModifiers(prism)
  expect(lines).toContain("+3 to Level of all Volcano Skills")
  expect(lines.some((line) => /^(Rarity|Radius|Limited)/.test(line))).toBe(
    false
  )
  expect(lines.some((line) => line.includes("{"))).toBe(false)
})

test("matching lines sum their numbers and keep a count", () => {
  const build = fixture("2k0EPn6QOhTx")
  const jewels = socketedJewels(
    build.items,
    build.treeSpecs[build.activeSpec]
  ).filter((jewel) => jewel.active)
  const stats = aggregateJewelStats(jewels.map((jewel) => jewel.item))
  const area = stats.find(
    (stat) => stat.template === "#% increased Presence Area of Effect"
  )!
  expect(area.count).toBe(2)
  expect(jewelStatText(area)).toBe("49% increased Presence Area of Effect")
  const fire = stats.find((stat) =>
    stat.template.startsWith("Damage Penetrates #% Fire")
  )!
  expect(fire.count).toBe(2)
  expect(jewelStatText(fire)).toBe("Damage Penetrates 20% Fire Resistance")
})

test("signed and unsigned numbers stay apart and decimals format cleanly", () => {
  const item = (text: string) => ({
    id: "1",
    name: "Test",
    rarity: "MAGIC",
    text,
  })
  const stats = aggregateJewelStats([
    item("Rarity: MAGIC\nTest\n+10 to Strength\n1.5% increased Speed"),
    item("Rarity: MAGIC\nTest\n10 to Strength\n1.25% increased Speed"),
  ] as never)
  expect(stats.map(jewelStatText)).toEqual([
    "+10 to Strength",
    "2.75% increased Speed",
    "10 to Strength",
  ])
})

test("a socket allocated by an item counts once the item and node name are known", () => {
  const build = fixture("zarokhs-gift")
  const spec = build.treeSpecs[build.activeSpec]
  const gear = build.itemSets.find((set) => set.id === build.activeItemSet)!
  const equipped = gear.slots.flatMap((slot) => {
    const item = build.items.find((entry) => entry.id === slot.itemId)
    return item ? [item] : []
  })
  expect(grantedAllocations(equipped).get("Zarokh's Gift")).toBe(
    "Onslaught Glance"
  )
  const bare = socketedJewels(build.items, spec).find(
    (jewel) => jewel.item.name === "Behemoth Wound"
  )!
  expect(bare.active).toBe(false)
  const resolved = socketedJewels(build.items, spec, {
    equipped,
    nodeNames: new Map([["11184", "Zarokh's Gift"]]),
  }).find((jewel) => jewel.item.name === "Behemoth Wound")!
  expect(resolved.active).toBe(true)
  expect(resolved.allocation).toEqual({
    kind: "item",
    node: "Zarokh's Gift",
    item: "Onslaught Glance",
  })
})

test("Voices lights as many sinister sockets as it allocates", () => {
  const item = (id: string, name: string, text: string) => ({
    id,
    name,
    rarity: "UNIQUE",
    text,
  })
  const items = [
    item(
      "1",
      "Voices",
      "Rarity: UNIQUE\nVoices\nSapphire\nAllocates 2 Sinister Jewel Sockets"
    ),
    item("2", "A", "Rarity: RARE\nA\nRuby\n+1 to Strength"),
    item("3", "B", "Rarity: RARE\nB\nRuby\n+1 to Strength"),
    item("4", "C", "Rarity: RARE\nC\nRuby\n+1 to Strength"),
  ] as never
  const spec = {
    nodes: ["100"],
    sockets: [
      { nodeId: "100", itemId: "1" },
      { nodeId: "3367", itemId: "2" },
      { nodeId: "23960", itemId: "3" },
      { nodeId: "26178", itemId: "4" },
    ],
  } as never
  const names = new Map([
    ["3367", "Sinister Jewel Socket"],
    ["23960", "Sinister Jewel Socket"],
    ["26178", "Sinister Jewel Socket"],
  ])
  const jewels = socketedJewels(items, spec, { nodeNames: names })
  expect(jewels.map((jewel) => jewel.active)).toEqual([true, true, true, false])
  expect(jewels[1].allocation).toEqual({
    kind: "item",
    node: "Sinister Jewel Socket",
    item: "Voices",
  })
})

test("weapon-set sockets retain their allocation source within spec.nodes", () => {
  const build = fixture("2k0EPn6QOhTx")
  const original = build.treeSpecs[build.activeSpec]
  const sockets = original.sockets!.slice(0, 3)
  const spec = {
    ...original,
    sockets,
    nodes: sockets.map((socket) => socket.nodeId),
    weaponSet1: [sockets[0].nodeId],
    weaponSet2: [sockets[1].nodeId],
  }
  expect(
    socketedJewels(build.items, spec).map((jewel) => jewel.allocation)
  ).toEqual([
    { kind: "weapon-set", set: 1 },
    { kind: "weapon-set", set: 2 },
    { kind: "tree" },
  ])
})

test("only selected variants grant named and sinister sockets", () => {
  const build = fixture("2k0EPn6QOhTx")
  const spec = build.treeSpecs[build.activeSpec]
  const sockets = spec.sockets!.slice(0, 3)
  const grant = {
    ...build.items.find((item) => item.id === sockets[0].itemId)!,
    selectedVariants: ["2"],
    text: "{variant:1}Allocates Other socket\n{variant:2}Allocates Saved socket\n{variant:1}Allocates 0 Sinister Jewel Sockets\n{variant:2}Allocates 1 Sinister Jewel Socket",
  }
  expect([...grantedAllocations([grant]).keys()]).toEqual([
    "Saved socket",
    "1 Sinister Jewel Socket",
  ])
  const jewels = socketedJewels(
    build.items.map((item) => (item.id === grant.id ? grant : item)),
    {
      ...spec,
      sockets,
      nodes: [sockets[0].nodeId],
      weaponSet1: [],
      weaponSet2: [],
    },
    {
      nodeNames: new Map([
        [sockets[1].nodeId, "Saved socket"],
        [sockets[2].nodeId, "Sinister Jewel Socket"],
      ]),
    }
  )
  expect(jewels.map((jewel) => jewel.active)).toEqual([true, true, true])
})
