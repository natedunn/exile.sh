import { cn } from "cn"
import { EffectList } from "./effect-list"
import type { TreeNode } from "../../shared/tree-render-model"
import { displayLine } from "../../shared/tree-jewels"

export function PassiveLines({
  items,
  hideSingleMarker = true,
  className,
}: {
  items: string[]
  hideSingleMarker?: boolean
  className?: string
}) {
  if (!items.length) return null
  return (
    <EffectList
      data-slot="tree-lines"
      hideSingleMarker={hideSingleMarker}
      className={cn(
        "[&>li]:text-xs [&>li]:leading-[1.45] [&>li+li]:mt-0.75",
        className
      )}
    >
      {items.map((line, index) => (
        <li key={index}>{displayLine(line)}</li>
      ))}
    </EffectList>
  )
}

export function PassiveNodeEffects({
  node,
}: {
  node: Pick<TreeNode, "stats" | "options">
}) {
  return (
    <>
      {node.options?.length ? (
        <section className="[&_p]:mt-0 [&_p]:text-ink [&_p+p]:mt-0.75">
          {node.stats.map((line, index) => (
            <p key={index}>
              {displayLine(line)}
              {index === node.stats.length - 1 && " (choose one):"}
            </p>
          ))}
        </section>
      ) : (
        <PassiveLines items={node.stats} />
      )}
      {!!node.options?.length && (
        <ol
          className="mt-2 list-decimal pl-4 font-display text-xs leading-[1.45] [&_li]:pl-1 [&_li]:whitespace-pre-line [&_li+li]:mt-1.5 [&_li::marker]:text-brand"
          aria-label="Available options"
        >
          {node.options.map((option) => (
            <li key={option}>{displayLine(option)}</li>
          ))}
        </ol>
      )}
    </>
  )
}
