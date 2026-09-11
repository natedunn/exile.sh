import { expect, test } from "vitest"
import { parseBuildXml } from "./pob"
import { treeAttributes } from "./tree-attributes"

const node = (id: string, name: string, stats: string[], notable = false) => ({
  id,
  name,
  stats,
  notable,
  keystone: false,
  start: false,
})
test("keeps per-spec attribute choices and separates dedicated nodes from other passives", () => {
  const build = parseBuildXml(
    `<PathOfBuilding2><Build className="Witch" level="90"/><Tree><Spec nodes="1,2,3,4,5,6,1,999" treeVersion="0_5"><Overrides><AttributeOverride intNodes="1" strNodes="2" dexNodes=""/></Overrides></Spec><Spec nodes="1" treeVersion="0_5"><Overrides><AttributeOverride dexNodes="1"/></Overrides></Spec></Tree></PathOfBuilding2>`
  )
  const tree = [
    node("1", "Attribute", ["+5 to any Attribute"]),
    node("2", "Attribute", ["+5 to any Attribute"]),
    node("3", "All Attributes", ["+3 to all Attributes"]),
    node(
      "4",
      "Mixed benefit",
      [
        "+5 to Strength and Intelligence",
        "6% increased Intelligence",
        "+1 to Intelligence per 10 Dexterity",
      ],
      true
    ),
    node("5", "Attribute", ["+5 to any Attribute"]),
    node("6", "Great Strength", ["+25 to Strength"], true),
    node("7", "Dexterity", ["+10 to Dexterity"]),
  ]
  const spec = build.treeSpecs[0]
  const result = treeAttributes(tree, spec.nodes, spec.attributeOverrides)
  expect(result.rows).toEqual([
    { name: "Intelligence", nodes: 2, dedicated: 8, other: 5, increased: 6 },
    { name: "Strength", nodes: 2, dedicated: 8, other: 30, increased: 0 },
    { name: "Dexterity", nodes: 1, dedicated: 3, other: 0, increased: 0 },
  ])
  expect(result.unresolved).toBe(1)
  expect(result.conditional).toBe(1)
  expect(result.unmapped).toBe(1)
  expect(
    treeAttributes(tree, ["1"], build.treeSpecs[1].attributeOverrides).rows[2]
      .dedicated
  ).toBe(5)
})
test("does not invent choices or count starting and unallocated nodes", () => {
  const tree = [
    node("1", "Attribute", ["+5 to any Attribute"]),
    { ...node("2", "Strength", ["+20 to Strength"]), start: true },
  ]
  const result = treeAttributes(tree, ["1", "2"])
  expect(result.unresolved).toBe(1)
  expect(
    result.rows.every((row) => row.dedicated === 0 && row.other === 0)
  ).toBe(true)
})
