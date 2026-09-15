import type { TreeNode } from "../../shared/tree-render-model"
import { displayLine } from "../../shared/tree-jewels"

export function PassiveLines({
  items,
  className = "tree-lines",
}: {
  items: string[]
  className?: string
}) {
  if (!items.length) return null
  return (
    <ul className={className}>
      {items.map((line, index) => (
        <li key={index}>{displayLine(line)}</li>
      ))}
    </ul>
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
        <section className="tree-choice-intro">
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
        <ol className="tree-choice-lines" aria-label="Available options">
          {node.options.map((option) => (
            <li key={option}>{displayLine(option)}</li>
          ))}
        </ol>
      )}
    </>
  )
}
