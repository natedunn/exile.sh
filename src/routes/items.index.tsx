import { createFileRoute } from "@tanstack/react-router"
import { useDeferredValue, useMemo } from "react"
import { itemBySlug, searchItems } from "../../shared/item-registry"
import { useItemRegistry } from "../lib/use-item-registry"
import { pageShareImage } from "../lib/page-share"
import { shareMeta } from "../lib/share-meta"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Field, FieldLabel } from "../components/ui/field"
import { EmptyState } from "../components/ui/empty-state"
import { Note } from "../components/ui/note"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../components/ui/segmented-control"
import {
  PageHeading,
  PageHeadingCopy,
  PageTitle,
  PageMeta,
} from "../components/ui/page-heading"
import { ReferenceSelect } from "../components/item-registry-controls"
import { ItemResult } from "../components/item-result"
import { TooltipPinScope } from "../components/tooltip-pins"
import {
  BookmarkedResults,
  framedCell,
  framedGrid,
} from "../components/result-grid"
import { useItemBookmarks } from "../lib/use-saved-list"
import type { ItemSearch } from "./items"

export const Route = createFileRoute("/items/")({
  head: () =>
    shareMeta({
      title: "Items",
      description:
        "Search Path of Exile 2 uniques and bases. Explore unique rolls, implicit modifiers, and base modifier references.",
      path: "/items",
      image: pageShareImage("items"),
    }),
  component: ItemsPage,
})
const PAGE_SIZE = 60
const kindHeading = {
  unique: "All uniques",
  base: "All bases",
  all: "All items",
}

function ItemsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const catalogue = useItemRegistry()
  const query = useDeferredValue(search.q)
  const patch = (value: Partial<ItemSearch>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...value }),
      replace: true,
      resetScroll: false,
    })
  const classes = useMemo(
    () =>
      [
        ...new Set(
          Object.values(catalogue.data?.items ?? {})
            .filter(
              (item) => search.kind === "all" || item.kind === search.kind
            )
            .map((item) => item.itemClass)
        ),
      ].sort(),
    [catalogue.data, search.kind]
  )
  const results = useMemo(
    () =>
      catalogue.data
        ? searchItems(catalogue.data, query, search.kind, search.itemClass)
        : [],
    [catalogue.data, query, search.kind, search.itemClass]
  )
  const { favorites, toggleFavorite, storageError } = useItemBookmarks()
  const bookmarkSet = new Set(favorites)
  // Bookmarks lead a search; with no search they have their own section.
  const ordered = query.trim()
    ? [
        ...results.filter((item) => bookmarkSet.has(item.slug)),
        ...results.filter((item) => !bookmarkSet.has(item.slug)),
      ]
    : results
  const pinned = query.trim()
    ? []
    : results.filter((item) => bookmarkSet.has(item.slug))
  const visible = search.page * PAGE_SIZE
  const renderItem = (className: string) => (item: (typeof results)[number]) =>
    catalogue.data && (
      <ItemResult
        key={item.slug}
        item={item}
        base={
          item.kind === "unique" && item.baseSlug
            ? itemBySlug(catalogue.data, item.baseSlug)
            : undefined
        }
        search={search}
        bookmarked={bookmarkSet.has(item.slug)}
        onBookmarkedChange={() => toggleFavorite(item.slug)}
        className={className}
      />
    )
  return (
    <div className="pb-12">
      <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)]">
        <PageHeadingCopy>
          <PageTitle>Items</PageTitle>
          <PageMeta>
            <span>Uniques &amp; bases</span>
          </PageMeta>
        </PageHeadingCopy>
        <img
          src="/art/items-masthead.png"
          alt=""
          aria-hidden="true"
          width="190"
          height="100"
          decoding="async"
          fetchPriority="high"
          className="pointer-events-none absolute top-0 right-0 z-0 h-full max-h-50 w-auto opacity-85 select-none [image-rendering:pixelated] max-sm:opacity-45"
        />
      </PageHeading>
      <div className="-mx-[var(--shell-gutter)] flex flex-wrap items-end gap-4 border-b border-rule-strong px-[var(--shell-gutter)] py-5">
        <Field className="max-w-180 min-w-0 flex-1 max-sm:basis-full">
          <FieldLabel htmlFor="item-search">Search items</FieldLabel>
          <Input
            id="item-search"
            disabled={catalogue.isPending}
            type="search"
            placeholder="Name, base, or modifier text…"
            value={search.q}
            onChange={(event) => patch({ q: event.target.value, page: 1 })}
            className="h-9"
          />
        </Field>
        <ReferenceSelect
          id="item-class"
          disabled={catalogue.isPending}
          label="Item type"
          value={search.itemClass}
          options={[
            { value: "", label: "All item types" },
            ...classes.map((label) => ({ value: label, label })),
          ]}
          onChange={(itemClass) => patch({ itemClass, page: 1 })}
        />
        <SegmentedControl aria-label="Item catalogue" className="h-9">
          {(
            [
              ["unique", "Uniques"],
              ["base", "Bases"],
              ["all", "All"],
            ] as const
          ).map(([kind, label]) => (
            <SegmentedControlItem
              key={kind}
              disabled={catalogue.isPending}
              active={search.kind === kind}
              aria-pressed={search.kind === kind}
              className="h-full"
              onClick={() => patch({ kind, itemClass: "", page: 1 })}
            >
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className="pt-4">
        {storageError && (
          <Note className="mt-4" role="status">
            Your browser could not save bookmarks. They will last only for this
            session.
          </Note>
        )}
        {catalogue.isError ? (
          <Note className="mt-6" role="alert">
            Item references could not be loaded.{" "}
            <Button
              variant="link"
              size="bare"
              onClick={() => void catalogue.refetch()}
            >
              Try again
            </Button>
          </Note>
        ) : catalogue.isPending ? (
          <p className="py-8 text-sm text-ink-muted" role="status">
            Loading items…
          </p>
        ) : (
          <TooltipPinScope maxPinnedTooltips={1}>
            {pinned.length > 0 && (
              <BookmarkedResults count={pinned.length} noun="item">
                {pinned.map(renderItem(framedCell))}
              </BookmarkedResults>
            )}
            <div className="mt-6 flex items-baseline justify-between gap-3 pb-2">
              <h2 className="font-display text-2xl text-ink">
                {search.q.trim() ? "Results" : kindHeading[search.kind]}
              </h2>
              <p className="font-mono text-label text-ink-muted" role="status">
                {results.length.toLocaleString()}{" "}
                {results.length === 1 ? "item" : "items"}
              </p>
            </div>
            {results.length ? (
              <>
                <ul data-testid="item-results" className={framedGrid}>
                  {ordered.slice(0, visible).map(renderItem(framedCell))}
                </ul>
                {visible < results.length && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => patch({ page: search.page + 1 })}
                  >
                    Show more items ({results.length - visible} remaining)
                  </Button>
                )}
              </>
            ) : (
              <EmptyState frame="dashed" className="mt-4">
                No items match that search.
              </EmptyState>
            )}
          </TooltipPinScope>
        )}
        <p className="mt-6 text-xs leading-relaxed text-ink-muted">
          Reference data from Path of Building and RePoE. Modifier references
          describe individual eligibility; crafting combination validation is
          still to come.
        </p>
      </div>
    </div>
  )
}
