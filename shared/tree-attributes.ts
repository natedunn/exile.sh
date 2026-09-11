import type { BuildSnapshot } from "./pob"

export type AttributeOverrides = NonNullable<
  BuildSnapshot["treeSpecs"][number]["attributeOverrides"]
>
type Node = {
  id: string
  name: string
  stats: string[]
  notable: boolean
  keystone: boolean
  start: boolean
}
const names = ["Intelligence", "Strength", "Dexterity"] as const
type Attribute = (typeof names)[number]
const flat =
  /^\+(\d+) to ((?:Strength|Dexterity|Intelligence)(?: and (?:Strength|Dexterity|Intelligence))?|all Attributes)$/i

/** Base allocated passives only; never treat conditional or per-attribute effects as flat bonuses. */
export function treeAttributes(
  tree: Node[],
  allocated: string[],
  overrides?: AttributeOverrides
) {
  const selected = new Set(allocated)
  const choices = new Map<string, Attribute>()
  for (const name of names) {
    for (const id of overrides?.[
      name.toLowerCase() as keyof AttributeOverrides
    ] || [])
      choices.set(id, name)
  }
  const rows = names.map((name) => ({
    name,
    nodes: 0,
    dedicated: 0,
    other: 0,
    increased: 0,
  }))
  let unresolved = 0
  let conditional = 0
  for (const node of tree) {
    if (!selected.has(node.id) || node.start) continue
    const choice =
      node.name === "Attribute" &&
      node.stats.some((s) => /^\+\d+ to any Attribute$/.test(s))
    const stats = choice
      ? node.stats.map((s) =>
          choices.has(node.id)
            ? s.replace("any Attribute", choices.get(node.id)!)
            : s
        )
      : node.stats
    if (choice && !choices.has(node.id)) {
      unresolved++
      continue
    }
    const dedicated =
      !node.notable &&
      !node.keystone &&
      /^(Attribute|Attributes|All Attributes|Strength|Dexterity|Intelligence)$/i.test(
        node.name
      ) &&
      stats.length > 0 &&
      stats.every((s) => flat.test(s))
    const counted = new Set<string>()
    for (const stat of stats) {
      const match = stat.match(flat)
      const percentage = stat.match(
        /^(\d+)% (increased|reduced) (Strength|Dexterity|Intelligence|Attributes|all Attributes)$/i
      )
      if (match || percentage) {
        const target = (match?.[2] || percentage![3]).toLowerCase()
        for (const row of rows) {
          if (
            !target.split(" and ").includes(row.name.toLowerCase()) &&
            !target.includes("attributes")
          )
            continue
          if (match) {
            row[dedicated ? "dedicated" : "other"] += Number(match[1])
            if (dedicated && !counted.has(row.name)) {
              row.nodes++
              counted.add(row.name)
            }
          } else
            row.increased +=
              Number(percentage![1]) * (percentage![2] === "reduced" ? -1 : 1)
        }
      } else if (
        /\b(Strength|Dexterity|Intelligence|Attributes?)\b/i.test(stat)
      )
        conditional++
    }
  }
  return {
    rows,
    unresolved,
    conditional,
    unmapped: [...selected].filter((id) => !tree.some((n) => n.id === id))
      .length,
  }
}
