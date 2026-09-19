import {
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import type { Ref } from "react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { Diamond } from "lucide-react"
import type { TreeNode } from "../../shared/tree-render-model"
import { Button } from "./ui/button"

export type TreeSearchResultsHandle = { focus: (index: number) => void }
export const TreeSearchResults = memo(function TreeSearchResults({
  results,
  label = "Matching nodes",
  artwork,
  onSelect,
  ref,
}: {
  label?: string
  results: TreeNode[]
  artwork?: Record<string, string>
  onSelect: (node: TreeNode) => void
  ref?: Ref<TreeSearchResultsHandle>
}) {
  const list = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(-1)
  const pendingFocus = useRef(false)
  const virtual = results.length > 40
  const virtualizer = useVirtualizer({
    count: results.length,
    enabled: virtual,
    getScrollElement: () => list.current,
    estimateSize: () => 140,
    getItemKey: useCallback((index: number) => results[index].id, [results]),
    overscan: 4,
    rangeExtractor: useCallback(
      (range) => {
        const indices = defaultRangeExtractor(range)
        return active >= 0 && active < results.length
          ? [...new Set([...indices, active])].sort((a, b) => a - b)
          : indices
      },
      [active, results.length]
    ),
  })
  useImperativeHandle(ref, () => ({
    focus(index) {
      pendingFocus.current = true
      setActive(index)
      if (virtual) virtualizer.scrollToIndex(index, { align: "auto" })
      else {
        const button = list.current?.querySelector<HTMLButtonElement>(
          `[data-result-index="${index}"]`
        )
        button?.focus({ preventScroll: true })
        if (button && list.current) {
          const bounds = list.current.getBoundingClientRect()
          const row = button.getBoundingClientRect()
          if (row.top < bounds.top)
            list.current.scrollTop -= bounds.top - row.top + 4
          else if (row.bottom > bounds.bottom)
            list.current.scrollTop += row.bottom - bounds.bottom + 4
        }
        pendingFocus.current = false
      }
    },
  }))
  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const button = list.current?.querySelector<HTMLButtonElement>(
      `[data-result-index="${active}"]`
    )
    if (button) {
      button.focus({ preventScroll: true })
      pendingFocus.current = false
    }
  })
  const rows = virtual
    ? virtualizer.getVirtualItems()
    : results.map((node, index) => ({ key: node.id, index, start: 0 }))
  return (
    <ul
      ref={list}
      data-slot="tree-results"
      className="relative -mx-1 my-0 min-h-0 list-none overflow-y-auto overscroll-contain p-1"
      aria-label={label}
      data-result-count={results.length}
    >
      {virtual && (
        <li
          role="presentation"
          aria-hidden="true"
          style={{ height: virtualizer.getTotalSize() }}
        />
      )}
      {rows.map((row) => {
        const node = results[row.index]
        return (
          <li
            key={row.key}
            ref={virtual ? virtualizer.measureElement : undefined}
            data-index={row.index}
            aria-posinset={row.index + 1}
            aria-setsize={results.length}
            style={
              virtual
                ? {
                    position: "absolute",
                    top: 0,
                    left: 4,
                    right: 4,
                    transform: `translateY(${row.start}px)`,
                  }
                : undefined
            }
          >
            <Button
              variant="ghost"
              className="group/result h-auto w-full items-start justify-start gap-2.5 border border-transparent py-2.5 pr-1 pl-2.5 text-left whitespace-normal hover:border-brand-deep hover:bg-notice-strong hover:text-brand-ink focus-visible:border-brand-deep focus-visible:bg-notice-strong focus-visible:text-brand-ink"
              data-result-index={row.index}
              onFocus={() => setActive(row.index)}
              onClick={() => onSelect(node)}
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden bg-surface text-ink-faint [&_img]:size-9 [&_img]:object-contain">
                {artwork?.[node.icon] ? (
                  <img
                    src={artwork[node.icon]}
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Diamond aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 wrap-anywhere">
                <strong className="block text-sm leading-[1.2] font-bold text-ink">
                  {node.name}
                </strong>
                <span
                  className="mt-1.5 grid gap-1 text-2xs text-ink-muted group-hover/result:text-ink group-focus-visible/result:text-ink empty:hidden"
                  role="list"
                >
                  {(node.stats.length ? node.stats : (node.options ?? []))
                    .flatMap((line) => line.split("\n"))
                    .filter((line) => line.trim())
                    .map((line, index) => (
                      <span
                        key={index}
                        role="listitem"
                        className="relative block pl-3.5 leading-[1.45]"
                      >
                        {line}
                      </span>
                    ))}
                </span>
              </span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
})
