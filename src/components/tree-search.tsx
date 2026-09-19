import { TreeSearchResults } from "./tree-search-results"
import type { TreeSearchResultsHandle } from "./tree-search-results"
import {
  announceTreePanelOpen,
  useTreePanelCoordination,
} from "./tree-panel-state"
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
import {
  drawer,
  drawerPanel,
  drawerTrack,
  panelHandle,
} from "./tree-panel-classes"
import { cn } from "cn"
import { flushSync } from "react-dom"

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
  const focusInput = useCallback(
    () => input.current?.focus({ preventScroll: true }),
    []
  )
  const openSearch = useCallback(() => {
    flushSync(() => setOpen(true))
    if (root.current) announceTreePanelOpen(root.current)
    focusInput()
  }, [focusInput])
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
    focusInput()
    const frame = requestAnimationFrame(() => {
      // A fast keypress may already have moved focus into the results.
      if (
        document.activeElement === trigger.current ||
        !root.current?.contains(document.activeElement)
      ) {
        focusInput()
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [open, focusInput])
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
          element.closest("[data-passive-tree]")?.contains(target)
        ) ?? candidates[0]
      if (owner !== root.current) return
      event.preventDefault()
      openSearch()
    }
    document.addEventListener("keydown", handle)
    return () => document.removeEventListener("keydown", handle)
  }, [searchHotkey, openSearch])
  return (
    <div
      ref={root}
      className={drawer}
      data-tree-drawer=""
      data-open={open}
      data-tree-search={searchHotkey || undefined}
    >
      <div className={drawerTrack}>
        <Button
          className={cn(panelHandle, "max-w-full")}
          ref={trigger}
          variant="outline"
          aria-label={open ? "Close tree search" : "Search tree"}
          aria-expanded={open}
          aria-controls={id}
          aria-keyshortcuts={searchHotkey ? "f" : undefined}
          onClick={() => (open ? close() : openSearch())}
        >
          {open ? <ArrowRight /> : <Search />}
          {!open && (
            <span
              className="min-w-0 truncate max-md:hidden"
              title={query.trim() || undefined}
            >
              {query.trim() || "Search"}
            </span>
          )}
          {!open && searchHotkey && (
            <span
              className="ml-3 shrink-0 max-md:hidden [&_kbd]:rounded [&_kbd]:border [&_kbd]:border-rule-strong [&_kbd]:px-1.5 [&_kbd]:py-0.5"
              aria-hidden="true"
            >
              <kbd>F</kbd>
            </span>
          )}
        </Button>
        <section
          id={id}
          data-slot="tree-search-panel"
          className={drawerPanel}
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
                if (next < 0) focusInput()
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
          <div className="flex min-h-6 items-center">
            <strong>Search tree</strong>
          </div>
          <InputGroup className="shrink-0">
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
                <span
                  className="[&_kbd]:rounded [&_kbd]:border [&_kbd]:border-rule-strong [&_kbd]:px-1.5 [&_kbd]:py-0.5"
                  aria-hidden="true"
                >
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
                    focusInput()
                  }}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <p className="text-2xs text-ink-muted" role="status">
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
