import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { JewelCardContent } from "./jewel-card-content"
import { describeEquipment } from "../../shared/equipment"
import { ReferenceLine } from "./reference-tooltip"
import { EmptyState } from "./ui/empty-state"
import { Note } from "./ui/note"
import {
  StatsBody,
  StatsCaption,
  StatsHeading,
  StatsSection,
} from "./build/stats-ledger"
import {
  aggregateJewelStats,
  SINISTER_SOCKET,
  socketedJewels,
} from "../../shared/jewel-stats"
import type { JewelStat, SocketedJewel } from "../../shared/jewel-stats"
import type { BuildSnapshot } from "../../shared/pob"
import type { TreeData } from "../../shared/tree-render-model"
import { isTreeVersion } from "../../shared/tree-versions"
import { cn } from "cn"
import { itemCard, jewelCard } from "./equipment-classes"

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
      <Note className="my-3" role="status">
        {message}
      </Note>
    )
  if (!jewels.length)
    return (
      <EmptyState frame="dashed" className="my-0">
        No jewels socketed in this setup.
      </EmptyState>
    )
  return (
    <>
      {message && (
        <Note className="my-3" role="status">
          {message}
        </Note>
      )}
      {/* Two columns of cards, one under xl. Cards in a row share its
          height, so a short card never leaves a hole beside a tall one. */}
      <div className="grid grid-cols-2 items-stretch gap-4 max-xl:grid-cols-1">
        {jewels.map((jewel) => {
          const note = allocationNote(jewel)
          const details = describeEquipment(jewel.item)
          return (
            <article
              key={`${jewel.nodeId}:${jewel.item.id}`}
              data-slot="build-jewel-card"
              className={cn(itemCard, jewelCard)}
              data-rarity={details.rarity}
              data-active={jewel.active}
            >
              <JewelCardContent item={jewel.item} />
              {note && (
                <footer className="border-t border-(--inspection-border) px-4.5 pt-2.5 pb-3">
                  <span className="font-mono text-label text-ink-faint">
                    {note}
                  </span>
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
const statLineClass =
  "flex items-baseline justify-between gap-4 border-b border-rule py-[7px] text-xs leading-[1.45] text-ink-muted [&>span]:min-w-0 [&>span]:[overflow-wrap:anywhere]"
function StatCount({ count }: { count: number }) {
  if (count < 2) return null
  return (
    <small className="shrink-0 font-mono text-label text-ink-faint">
      ×{count}
    </small>
  )
}
function StatLine({ stat }: { stat: JewelStat }) {
  // Interleave the summed numbers with the template text so the figures
  // read in the ledger's mono voice.
  const parts = stat.template.split("#")
  if (!stat.values.length)
    return (
      <li className={statLineClass}>
        {/* A referenced skill or passive keeps its icon beside the text. */}
        <span className="flex items-center gap-2 [&_img]:size-5 [&_img]:shrink-0 [&_svg]:size-5 [&_svg]:shrink-0">
          <ReferenceLine text={stat.template} />
        </span>
        <StatCount count={stat.count} />
      </li>
    )
  return (
    <li className={statLineClass}>
      <span>
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < stat.values.length && (
              <strong className="figure font-medium text-ink">
                {formatValue(stat.values[index])}
              </strong>
            )}
          </span>
        ))}
      </span>
      <StatCount count={stat.count} />
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
      <StatsBody>
        <StatsSection>
          <StatsHeading>From jewels</StatsHeading>
          <Note className="my-3" role="status">
            {message}
          </Note>
        </StatsSection>
      </StatsBody>
    )
  const active = jewels.filter((jewel) => jewel.active)
  const stats = aggregateJewelStats(active.map((jewel) => jewel.item))
  return (
    <StatsBody data-slot="build-jewel-stats">
      <StatsSection>
        <StatsHeading>From jewels</StatsHeading>
        {message && (
          <Note className="my-3" role="status">
            {message}
          </Note>
        )}
        <StatsCaption>
          {jewels.length === 1 ? "1 jewel" : `${jewels.length} jewels`}
          {jewels.length > active.length &&
            ` · ${active.length} in allocated sockets`}
        </StatsCaption>
        {stats.length ? (
          <ul className="m-0 list-none p-0">
            {stats.map((stat) => (
              <StatLine key={stat.template} stat={stat} />
            ))}
          </ul>
        ) : (
          <Note className="my-3">
            {jewels.length
              ? "None of the socketed jewels sit in an allocated socket."
              : "No jewel modifiers in this tree."}
          </Note>
        )}
      </StatsSection>
    </StatsBody>
  )
}
