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
  unique: "font-display text-xl text-item-unique",
  base: "font-display text-xl text-ink",
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
      <PageHeading>
        <PageHeadingCopy>
          <PageTitle>Items</PageTitle>
          <PageMeta>
            <span>
              <strong>Path of Exile 2</strong>
            </span>
            <span>Uniques &amp; bases</span>
          </PageMeta>
        </PageHeadingCopy>
      </PageHeading>
      <div className="flex flex-wrap items-end gap-4 border-b border-rule-strong py-5">
        <Field className="min-w-0 flex-1 max-sm:basis-full">
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
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <SegmentedControl aria-label="Item catalogue">
          {(
            [
              ["unique", "Uniques"],
              ["base", "Bases"],
              ["all", "All items"],
            ] as const
          ).map(([kind, label]) => (
            <SegmentedControlItem
              key={kind}
              disabled={catalogue.isPending}
              active={search.kind === kind}
              aria-pressed={search.kind === kind}
              onClick={() => patch({ kind, itemClass: "", page: 1 })}
            >
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <p className="mono-label text-ink-muted" role="status">
          {catalogue.isPending
            ? "Loading items…"
            : `${results.length.toLocaleString()} ${results.length === 1 ? "item" : "items"}`}
        </p>
      </div>
      {catalogue.isError ? (
        <Note role="alert">
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
        <p className="py-8 text-sm text-ink-muted">
          Loading the item registry…
        </p>
      ) : !results.length ? (
        <EmptyState frame="dashed">No items match that search.</EmptyState>
      ) : (
        <>
          <ul
            className="m-0 grid list-none grid-cols-2 border-t border-l border-rule-strong bg-surface p-0 max-md:grid-cols-1"
            data-testid="item-results"
          >
            {results.slice(0, visible).map((item) => (
              <li
                key={item.slug}
                className="min-w-0 border-r border-b border-rule-strong"
              >
                <Link
                  to="/items/$item"
                  params={{ item: item.slug }}
                  search={search}
                  className="flex h-full items-center gap-4 p-4 no-underline hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <ItemRegistryImage src={item.image} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={itemNameClass[item.kind]}>
                        {item.name}
                      </span>
                      <Badge variant="outline">{item.kind}</Badge>
                      {item.kind === "base" && item.form !== "original" && (
                        <Badge variant="outline">{item.form}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {item.kind === "unique" ? item.baseName : item.itemClass}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                      {item.kind === "unique"
                        ? (item.modifiers.find((mod) => !mod.variants.length)
                            ?.text ?? item.itemClass)
                        : item.implicits.join(" · ") ||
                          "View base stats and modifier reference"}
                    </p>
                  </div>
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
      )}
      <p className="mt-6 text-xs leading-relaxed text-ink-muted">
        Reference data from Path of Building and RePoE. Modifier references
        describe individual eligibility; crafting combination validation is
        still to come.
      </p>
    </div>
  )
}
