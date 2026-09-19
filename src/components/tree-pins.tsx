import { useEffect, useRef, useState } from "react"
import { Pin } from "lucide-react"
import type { TreeNode } from "../../shared/tree-render-model"
import { usePinnedTreeNodes, useClearTreePins } from "./tooltip-pins"
import { useTreePanelCoordination } from "./tree-panel-state"
import { TreeSearchResults } from "./tree-search-results"
import type { TreeSearchResultsHandle } from "./tree-search-results"
import { Button } from "./ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover"

export function TreePins({
  artwork,
  onSelect,
}: {
  artwork?: Record<string, string>
  onSelect: (node: TreeNode) => void
}) {
  const nodes = usePinnedTreeNodes()
  const clearPins = useClearTreePins()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const results = useRef<TreeSearchResultsHandle>(null)
  useTreePanelCoordination(root, open, setOpen)
  useEffect(() => {
    if (!nodes.length) setOpen(false)
  }, [nodes.length])
  return (
    <div
      ref={root}
      className="absolute bottom-3.5 left-1/2 z-51 -translate-x-1/2 border border-rule-strong bg-paper p-1.5 shadow-menu empty:hidden max-md:left-3.5 max-md:translate-x-0 [&>button]:h-8 [&>button]:border-rule-strong [&>button]:bg-surface [&>button]:hover:border-brand-deep [&>button]:hover:text-brand"
      data-open={open}
      data-tree-pins=""
    >
      {nodes.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={<Button variant="outline" />}
            aria-label={`${nodes.length} pinned ${nodes.length === 1 ? "node" : "nodes"}`}
          >
            <Pin /> {nodes.length}{" "}
            <span className="max-md:hidden">
              pinned {nodes.length === 1 ? "node" : "nodes"}
            </span>
          </PopoverTrigger>
          <PopoverContent
            data-tree-pins-panel=""
            className="max-h-[min(70dvh,var(--available-height))] w-[min(440px,calc(100vw-24px))] overflow-hidden border-rule-strong bg-paper p-3 text-ink [&_ul]:min-h-0"
            positionerClassName="z-52"
            side="top"
            sideOffset={8}
            align="center"
            collisionPadding={12}
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
                return
              event.preventDefault()
              const current = Number(
                (event.target as HTMLElement)
                  .closest("[data-result-index]")
                  ?.getAttribute("data-result-index") ?? -1
              )
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? nodes.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          nodes.length - 1,
                          current + (event.key === "ArrowDown" ? 1 : -1)
                        )
                      )
              results.current?.focus(next)
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <PopoverTitle className="flex items-center gap-2 text-base [&_svg]:size-4">
                <Pin aria-hidden="true" /> Pinned nodes
              </PopoverTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  clearPins()
                }}
              >
                Clear all pins
              </Button>
            </div>
            <TreeSearchResults
              ref={results}
              label="Pinned nodes"
              results={nodes}
              artwork={artwork}
              onSelect={(node) => {
                setOpen(false)
                onSelect(node)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
