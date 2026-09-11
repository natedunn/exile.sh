import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { parseBuild } from "./pob"
import {
  treeJewels,
  jewelLines,
  radiusBenefits,
  displayLine,
} from "./tree-jewels"

const fixture = (name: string) =>
  parseBuild(
    readFileSync(
      new URL("./fixtures/pob/" + name + ".txt", import.meta.url),
      "utf8"
    )
  )
const nodes = JSON.parse(
  readFileSync(
    new URL("../public/pob-trees/v2/0_5.json", import.meta.url),
    "utf8"
  )
).nodes
test("From Nothing uses its named keystone rather than its jewel socket", () => {
  const build = fixture("Mu3PxErdMKiE")
  const spec = build.treeSpecs[build.activeSpec]
  const jewel = treeJewels(nodes, spec.sockets!, build.items, spec.nodes).find(
    (j) => j.item.name === "From Nothing"
  )!
  expect(jewel).toBeDefined()
  expect(jewel.areas).toHaveLength(1)
  expect(jewel.areas[0].outer).toBe(1200)
  expect(jewel.areas[0].centerId).not.toBe(jewel.origin.id)
  expect(
    nodes.find((n: { id: string }) => n.id === jewel.areas[0].centerId).name
  ).toBe("Eldritch Battery")
  // The keystone the radius is drawn around is not "within" its own radius.
  expect(jewel.areas[0].affected).not.toContain(jewel.areas[0].centerId)
  expect(jewel.areas[0].affected.length).toBeGreaterThan(0)
})
test("exported variants do not enable every From Nothing keystone", () => {
  const build = fixture("FxGea2RhOoqd")
  const item = build.items.find((i) => i.name === "From Nothing")!
  const activeLines = jewelLines(item).filter((l) =>
    /can be Allocated/i.test(l)
  )
  expect(activeLines).toHaveLength(1)
  expect(activeLines[0]).toContain("Resolute Technique")
})
test("Against the Darkness centers its radius at the equipped socket", () => {
  const build = fixture("R09ZhxGeretC")
  const spec = build.treeSpecs[build.activeSpec]
  const jewel = treeJewels(nodes, spec.sockets!, build.items, spec.nodes).find(
    (j) => j.item.name === "Against the Darkness"
  )!
  expect(jewel.areas[0].centerId).toBe(jewel.origin.id)
  expect(jewel.areas[0].outer).toBe(1200)
})
test("Controlled Metamorphosis draws an annulus and excludes its inner area", () => {
  const tree = [
    {
      id: "1",
      name: "Jewel Socket",
      x: 0,
      y: 0,
      notable: false,
      ascendancy: "",
      start: false,
    },
    {
      id: "2",
      name: "Inner",
      x: 100,
      y: 0,
      notable: false,
      ascendancy: "",
      start: false,
    },
    {
      id: "3",
      name: "Within",
      x: 1500,
      y: 0,
      notable: false,
      ascendancy: "",
      start: false,
    },
  ]
  const item = {
    id: "1",
    name: "Controlled Metamorphosis",
    rarity: "UNIQUE",
    text: "Rarity: UNIQUE\nControlled Metamorphosis\nDiamond\nRadius: Variable\nOnly affects Passives in Medium Ring",
  }
  const jewel = treeJewels(
    tree,
    [{ nodeId: "1", itemId: "1" }],
    [item],
    ["1"]
  )[0]
  expect(jewel.areas[0]).toMatchObject({
    inner: 1320,
    outer: 1680,
    affected: ["3"],
  })
  expect(
    treeJewels(tree, [{ nodeId: "1", itemId: "1" }], [item], [])[0].areas
  ).toEqual([])
})
test("unknown references are ignored and Timeless transformations are disclosed", () => {
  const item = {
    id: "1",
    name: "Heroic Tragedy",
    rarity: "UNIQUE",
    text: "Rarity: UNIQUE\nHeroic Tragedy\nTimeless Jewel\nRadius: Very Large",
  }
  const origin = {
    id: "1",
    name: "Jewel Socket",
    x: 0,
    y: 0,
    notable: false,
    ascendancy: "",
    start: false,
  }
  expect(
    treeJewels([origin], [{ nodeId: "1", itemId: "99" }], [item], ["1"])
  ).toEqual([])
  const jewel = treeJewels(
    [origin],
    [{ nodeId: "1", itemId: "1" }],
    [item],
    ["1"]
  )[0]
  expect(jewel.areas[0].outer).toBe(1800)
  expect(jewel.warning).toContain("not calculated")
})

test("Megalomaniac grants only the selected exported notable", () => {
  const origin = {
    id: "1",
    name: "Jewel Socket",
    x: 0,
    y: 0,
    notable: false,
    ascendancy: "",
    start: false,
  }
  const tree = [
    origin,
    { ...origin, id: "2", name: "Saved notable", notable: true },
    { ...origin, id: "3", name: "Other notable", notable: true },
  ]
  const item = {
    id: "1",
    name: "Megalomaniac",
    rarity: "UNIQUE",
    selectedVariants: ["2"],
    text: "Rarity: UNIQUE\nMegalomaniac\nDiamond\n{variant:1}Allocates Other notable\n{variant:2}Allocates Saved notable",
  }
  expect(
    treeJewels(tree, [{ nodeId: "1", itemId: "1" }], [item], ["1"])[0].grants
  ).toEqual(["2"])
})

test("radius grants resolve per node by small or notable scope", () => {
  const build = fixture("R09ZhxGeretC")
  const spec = build.treeSpecs[build.activeSpec]
  const jewels = treeJewels(nodes, spec.sockets!, build.items, spec.nodes)
  const darkness = jewels.find((j) => j.item.name === "Against the Darkness")!
  expect(darkness.radiusGrants).toEqual([
    { scope: "small", effect: "+2% to Fire Resistance" },
    { scope: "notable", effect: "Gain 4% of Damage as Extra Fire Damage" },
  ])
  expect(radiusBenefits(darkness, { notable: false })).toEqual([
    "+2% to Fire Resistance",
  ])
  expect(radiusBenefits(darkness, { notable: true })).toEqual([
    "Gain 4% of Damage as Extra Fire Damage",
  ])
  expect(radiusBenefits(darkness, { notable: false, keystone: true })).toEqual(
    []
  )
  // Rare Time-Lost jewels use the same wording, with PoB markup on some lines.
  const maelstrom = jewels.find((j) => j.item.name === "Maelstrom Eye")!
  expect(radiusBenefits(maelstrom, { notable: true })).toEqual([
    "7% increased Critical Hit Chance",
    "10% increased Critical Damage Bonus",
    "6% increased Magnitude of Ailments you inflict",
  ])
  expect(radiusBenefits(maelstrom, { notable: false })).toEqual([])
  expect(displayLine("{desecrated}Gain 1 Rage when Hit")).toBe(
    "Gain 1 Rage when Hit"
  )
})
