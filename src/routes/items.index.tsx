import { createFileRoute, Link } from "@tanstack/react-router"
import { useDeferredValue, useMemo } from "react"
import { searchItems } from "../../shared/item-registry"
import { useItemRegistry } from "../lib/use-item-registry"
import { pageShareImage } from "../lib/page-share"
import { shareMeta } from "../lib/share-meta"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Field, FieldLabel } from "../components/ui/field"
import { Badge } from "../components/ui/badge"
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
import { ItemRegistryImage } from "../components/item-registry-image"
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
const itemNameClass = {
  unique: "text-sm font-medium text-item-unique",
  base: "text-sm font-medium",
}
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
  const visible = search.page * PAGE_SIZE
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
          <>
            <div className="mt-6 flex items-baseline justify-between gap-3 border-b border-rule-strong pb-2">
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
                {/* Cells draw their own right and bottom rules against the
                    list's left rule, so a short final row closes cleanly. */}
                <ul
                  data-testid="item-results"
                  className="m-0 grid list-none grid-cols-3 border-l border-rule-strong p-0 max-lg:grid-cols-2 max-md:grid-cols-1"
                >
                  {results.slice(0, visible).map((item) => (
                    <li
                      key={item.slug}
                      className="min-w-0 border-r border-b border-rule-strong bg-surface"
                    >
                      {/* Hover glow: bronze through a radial dither mask baked
                          to the card's height and centred on the art, like
                          the currency masthead's glow (scripts/dither-art.mjs). */}
                      <Link
                        to="/items/$item"
                        params={{ item: item.slug }}
                        search={search}
                        className="group relative isolate flex h-full w-full items-center gap-3 overflow-hidden px-4 py-2 text-ink no-underline before:pointer-events-none before:absolute before:top-1/2 before:left-9 before:-z-1 before:size-21 before:-translate-x-1/2 before:-translate-y-1/2 before:bg-brand before:mask-(--dither-glow-item) before:mask-no-repeat before:opacity-0 before:transition-opacity before:duration-160 before:content-[''] hover:before:opacity-30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus focus-visible:before:opacity-30 motion-reduce:before:transition-none max-sm:px-3 max-sm:before:left-8"
                      >
                        <ItemRegistryImage src={item.image} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <strong
                            className={`truncate ${itemNameClass[item.kind]}`}
                          >
                            {item.name}
                          </strong>
                          <span className="flex min-w-0 items-center gap-2 font-mono text-label text-ink-muted">
                            <span className="truncate">
                              {item.kind === "unique"
                                ? item.baseName
                                : item.itemClass}
                            </span>
                            {item.kind === "base" &&
                              item.form !== "original" && (
                                <Badge variant="outline">{item.form}</Badge>
                              )}
                          </span>
                          <span className="truncate text-xs text-ink-muted">
                            {item.kind === "unique"
                              ? (item.modifiers.find(
                                  (mod) => !mod.variants.length
                                )?.text ?? item.itemClass)
                              : item.implicits.join(" · ") ||
                                "View base stats and modifier reference"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
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
          </>
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
