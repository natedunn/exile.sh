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
    <div ref={root} className="tree-pins" data-open={open}>
      {nodes.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={<Button variant="outline" />}
            aria-label={`${nodes.length} pinned ${nodes.length === 1 ? "node" : "nodes"}`}
          >
            <Pin /> {nodes.length}{" "}
            <span className="tree-pins-count-label">
              pinned {nodes.length === 1 ? "node" : "nodes"}
            </span>
          </PopoverTrigger>
          <PopoverContent
            className="tree-pins-panel"
            positionerClassName="tree-pins-positioner"
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
            <div className="tree-pins-heading">
              <PopoverTitle>
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
