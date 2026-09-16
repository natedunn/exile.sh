import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { JewelCardContent } from "./jewel-card-content"
import { describeEquipment } from "../../shared/equipment"
import { ReferenceLine } from "./reference-tooltip"
import {
  aggregateJewelStats,
  SINISTER_SOCKET,
  socketedJewels,
} from "../../shared/jewel-stats"
import type { JewelStat, SocketedJewel } from "../../shared/jewel-stats"
import type { BuildSnapshot } from "../../shared/pob"
import type { TreeData } from "../../shared/tree-render-model"
import { isTreeVersion } from "../../shared/tree-versions"

type Spec = BuildSnapshot["treeSpecs"][number]
type Gear = BuildSnapshot["itemSets"][number]

/** Socketed jewels from both the selected tree and item set. The tree's node
 * names let item-granted sockets, such as Zarokh's Gift, count as allocated;
 * the query shares its key with the tree section so the data loads once. */
function useSocketedJewels(build: BuildSnapshot, spec?: Spec, gear?: Gear) {
  const version = spec?.version ?? ""
  const tree = useQuery({
    queryKey: ["passive-tree-v4", version],
    enabled: isTreeVersion(version),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/pob-trees/v4/" + version + ".json")
      if (!response.ok) throw new Error("Tree data unavailable")
      return (await response.json()) as TreeData
    },
  })
  const jewels = useMemo(() => {
    const equipped = (gear?.slots ?? []).flatMap((slot) => {
      const item = build.items.find((entry) => entry.id === slot.itemId)
      return item ? [item] : []
    })
    const nodeNames = tree.data
      ? new Map(tree.data.nodes.map((node) => [node.id, node.name]))
      : undefined
    return socketedJewels(build.items, spec, { equipped, nodeNames, gear })
  }, [build.items, spec, gear, tree.data])
  const message =
    !jewels.some((jewel) => jewel.allocation.kind !== "equipment") || tree.data
      ? null
      : !isTreeVersion(version)
        ? "Tree jewel allocations and totals are unavailable for this tree version."
        : tree.isError
          ? "Tree data could not be loaded. Tree jewel allocations and totals are unavailable."
          : "Loading tree data to determine tree jewel allocations and totals…"
  return {
    jewels: tree.data
      ? jewels
      : jewels.filter((jewel) => jewel.allocation.kind === "equipment"),
    message,
  }
}

function allocationNote(jewel: SocketedJewel) {
  switch (jewel.allocation.kind) {
    case "equipment":
      return jewel.allocation.slot
    case "item":
      // Named sockets read by their name; the unnamed sinister sockets read
      // by the jewel that lights them, such as Voices.
      return `(${
        jewel.allocation.node === SINISTER_SOCKET
          ? jewel.allocation.item
          : jewel.allocation.node
      })`
    case "weapon-set":
      return `Weapon set ${jewel.allocation.set}`
    case "none":
      return "Socket not allocated"
    default:
      return null
  }
}

/** The jewels socketed in the selected setup, each laid out as its item
 * card with the art beside the modifiers. */
export function BuildJewels({
  build,
  spec,
  gear,
}: {
  build: BuildSnapshot
  spec?: Spec
  gear?: Gear
}) {
  const { jewels, message } = useSocketedJewels(build, spec, gear)
  if (message && !jewels.length)
    return (
      <p className="build-muted" role="status">
        {message}
      </p>
    )
  if (!jewels.length)
    return <p className="build-empty">No jewels socketed in this setup.</p>
  return (
    <>
      {message && (
        <p className="build-muted" role="status">
          {message}
        </p>
      )}
      <div className="build-jewel-cards">
        {jewels.map((jewel) => {
          const note = allocationNote(jewel)
          const details = describeEquipment(jewel.item)
          return (
            <article
              key={`${jewel.nodeId}:${jewel.item.id}`}
              className="build-jewel-card equipment-card"
              data-rarity={details.rarity}
              data-active={jewel.active}
            >
              <JewelCardContent item={jewel.item} />
              {note && (
                <footer className="build-jewel-card-footer">
                  <span className="build-jewel-note">{note}</span>
                </footer>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}

function formatValue(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "")
}
function StatLine({ stat }: { stat: JewelStat }) {
  // Interleave the summed numbers with the template text so the figures
  // read in the ledger's mono voice.
  const parts = stat.template.split("#")
  if (!stat.values.length)
    return (
      <li>
        <span className="build-jewel-stat-reference">
          <ReferenceLine text={stat.template} />
        </span>
        {stat.count > 1 && <small>×{stat.count}</small>}
      </li>
    )
  return (
    <li>
      <span>
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < stat.values.length && (
              <strong>{formatValue(stat.values[index])}</strong>
            )}
          </span>
        ))}
      </span>
      {stat.count > 1 && <small>×{stat.count}</small>}
    </li>
  )
}

/** Every modifier the allocated jewels add up to, for the figures column. */
export function JewelStats({
  build,
  spec,
  gear,
}: {
  build: BuildSnapshot
  spec?: Spec
  gear?: Gear
}) {
  const { jewels, message } = useSocketedJewels(build, spec, gear)
  if (message && !jewels.length)
    return (
      <div className="build-stats-body">
        <section>
          <h3>From jewels</h3>
          <p className="build-muted" role="status">
            {message}
          </p>
        </section>
      </div>
    )
  const active = jewels.filter((jewel) => jewel.active)
  const stats = aggregateJewelStats(active.map((jewel) => jewel.item))
  return (
    <div className="build-stats-body">
      <section>
        <h3>From jewels</h3>
        {message && (
          <p className="build-muted" role="status">
            {message}
          </p>
        )}
        <p className="build-stats-skill">
          {jewels.length === 1 ? "1 jewel" : `${jewels.length} jewels`}
          {jewels.length > active.length &&
            ` · ${active.length} in allocated sockets`}
        </p>
        {stats.length ? (
          <ul className="build-jewel-stats">
            {stats.map((stat) => (
              <StatLine key={stat.template} stat={stat} />
            ))}
          </ul>
        ) : (
          <p className="build-muted">
            {jewels.length
              ? "None of the socketed jewels sit in an allocated socket."
              : "No jewel modifiers in this tree."}
          </p>
        )}
      </section>
    </div>
  )
}
