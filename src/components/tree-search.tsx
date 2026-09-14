import { TreeSearchResults } from "./tree-search-results"
import type { TreeSearchResultsHandle } from "./tree-search-results"
import { useTreePanelCoordination } from "./tree-panel-state"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { ArrowRight, Search, X } from "lucide-react"
import type { TreeNode } from "../../shared/tree-render-model"
import { Button } from "./ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./ui/input-group"

export type TreeSearchOptions = {
  /** Show tree search. Defaults to true. */
  searchable?: boolean
  /** Enable the unmodified F shortcut. Defaults to true. */
  searchHotkey?: boolean
  /** Show clickable results below the input. Defaults to true. */
  showSearchResults?: boolean
}

export function TreeSearch({
  query,
  onQueryChange,
  results,
  onSelect,
  artwork,
  searching = false,
  searchHotkey = true,
  showSearchResults = true,
}: TreeSearchOptions & {
  searching?: boolean
  artwork?: Record<string, string>
  query: string
  onQueryChange: (query: string) => void
  results: TreeNode[]
  onSelect: (node: TreeNode) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const resultList = useRef<TreeSearchResultsHandle>(null)
  const id = useId()
  useTreePanelCoordination(root, open, setOpen)
  const close = useCallback(() => {
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }, [])
  const selectResult = useCallback(
    (node: TreeNode) => {
      onSelect(node)
      if (window.matchMedia("(max-width: 767px)").matches) close()
    },
    [onSelect, close]
  )
  useEffect(() => {
    if (!open) return
    input.current?.focus({ preventScroll: true })
    const frame = requestAnimationFrame(() => {
      // A fast keypress may already have moved focus into the results.
      if (
        document.activeElement === trigger.current ||
        !root.current?.contains(document.activeElement)
      ) {
        input.current?.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [open])
  useEffect(() => {
    if (!searchHotkey) return
    const handle = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "f"
      )
        return
      const target = event.target instanceof Element ? event.target : null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="textbox"]'
        )
      )
        return
      // Only one visible tree handles F; prefer the focused tree and active dialog.
      const scope = target?.closest('[role="dialog"]') ?? document
      const candidates = [
        ...scope.querySelectorAll<HTMLElement>("[data-tree-search]"),
      ].filter((element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          !element.closest('[inert], [aria-hidden="true"]')
        )
      })
      const owner =
        candidates.find((element) =>
          element.closest(".passive-tree")?.contains(target)
        ) ?? candidates[0]
      if (owner !== root.current) return
      event.preventDefault()
      setOpen(true)
      input.current?.focus({ preventScroll: true })
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [searchHotkey])
  return (
    <div
      ref={root}
      className="tree-search tree-drawer"
      data-open={open}
      data-tree-search={searchHotkey || undefined}
    >
      <div className="tree-drawer-track">
        <Button
          className="tree-panel-handle"
          ref={trigger}
          variant="outline"
          aria-label={open ? "Close tree search" : "Search tree"}
          aria-expanded={open}
          aria-controls={id}
          aria-keyshortcuts={searchHotkey ? "f" : undefined}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {open ? <ArrowRight /> : <Search />}
          {!open && (
            <span
              className="tree-search-trigger-label"
              title={query.trim() || undefined}
            >
              {query.trim() || "Search"}
            </span>
          )}
          {!open && searchHotkey && (
            <span className="search-hotkey" aria-hidden="true">
              <kbd>F</kbd>
            </span>
          )}
        </Button>
        <section
          id={id}
          className="tree-search-panel"
          data-open={open}
          inert={!open}
          aria-hidden={!open}
          aria-label="Tree search"
          onKeyDown={(event) => {
            if (
              event.nativeEvent.isComposing ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey
            )
              return
            const target = event.target as HTMLElement
            const index = Number(
              target
                .closest("[data-result-index]")
                ?.getAttribute("data-result-index") ?? -1
            )
            const fromInput = event.target === input.current
            if (
              showSearchResults &&
              results.length &&
              (fromInput || index >= 0)
            ) {
              let next: number | undefined
              if (event.key === "ArrowDown")
                next = Math.min(index + 1, results.length - 1)
              if (event.key === "ArrowUp")
                next = fromInput ? results.length - 1 : index - 1
              if (!fromInput && event.key === "Home") next = 0
              if (!fromInput && event.key === "End") next = results.length - 1
              if (next !== undefined) {
                event.preventDefault()
                event.stopPropagation()
                if (next < 0) input.current?.focus({ preventScroll: true })
                else resultList.current?.focus(next)
                return
              }
            }
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <div className="tree-search-heading">
            <strong>Search tree</strong>
          </div>
          <InputGroup className="search-input">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              ref={input}
              aria-label="Search nodes"
              placeholder="Node name or stat…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {!query && searchHotkey && (
              <InputGroupAddon align="inline-end">
                <span className="search-hotkey" aria-hidden="true">
                  <kbd>F</kbd>
                </span>
              </InputGroupAddon>
            )}
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => {
                    onQueryChange("")
                    input.current?.focus({ preventScroll: true })
                  }}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <p role="status">
            {searching
              ? "Searching…"
              : query.trim()
                ? `${results.length} matching ${results.length === 1 ? "node" : "nodes"}`
                : "Search names and stats across this tree."}
          </p>
          {open && showSearchResults && results.length > 0 && (
            <TreeSearchResults
              ref={resultList}
              results={results}
              artwork={artwork}
              onSelect={selectResult}
            />
          )}
        </section>
      </div>
    </div>
  )
}
