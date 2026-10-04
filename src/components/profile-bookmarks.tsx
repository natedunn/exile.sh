import { cn } from "cn"
import type * as React from "react"
import { Link } from "@tanstack/react-router"
import { Diamond } from "lucide-react"
import { textLink } from "./ui/link-styles"
import { Button } from "./ui/button"
import { EmptyState, EmptyStateText } from "./ui/empty-state"
import { Panel } from "./ui/panel"
import { ItemRegistryImage } from "./item-registry-image"
import { useGemBookmarks, useItemBookmarks } from "@/lib/use-saved-list"
import { useGemCatalogue } from "@/lib/use-gem-catalogue"
import { useItemRegistry } from "@/lib/use-item-registry"
import { defaultGemSearch } from "@/routes/gems"
import { itemSearch } from "@/routes/items"
import { gemSlug } from "../../shared/gem-slug"

type Saved = ReturnType<typeof useGemBookmarks>
type Row = {
  id: string
  name: string
  icon: React.ReactNode
  meta: string
  link: (className: string) => React.ReactNode
}

const linkClass =
  "min-w-0 flex-1 text-sm wrap-anywhere text-ink hover:text-brand"

/* One kind of bookmark on the Saved page. Rows need the reference catalogue
   for names and art, which is only fetched once something is bookmarked. */
function BookmarkList({
  id,
  title,
  description,
  noun,
  saved,
  catalogue,
  empty,
  rows,
}: {
  id: string
  title: string
  description: string
  /** Plural, e.g. "gems". */
  noun: string
  saved: Saved
  catalogue: { isPending: boolean; isError: boolean; refetch: () => unknown }
  empty: React.ReactNode
  rows: Row[]
}) {
  const waiting = saved.favorites.length > 0 && catalogue.isPending
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="font-display text-2xl text-ink">
        {title}
      </h3>
      <p className="text-sm text-ink-muted">{description}</p>
      {(saved.isLoading || waiting) && (
        <p role="status">Loading your bookmarked {noun}…</p>
      )}
      {(saved.error || catalogue.isError) && (
        <>
          <p role="alert" className="text-sm text-negative">
            Your bookmarked {noun} could not be loaded or updated.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              saved.retry()
              void catalogue.refetch()
            }}
          >
            Try again
          </Button>
        </>
      )}
      {!saved.isLoading && !saved.error && !saved.favorites.length && (
        <EmptyState size="inline">{empty}</EmptyState>
      )}
      {rows.length > 0 && (
        <Panel>
          <ul className="divide-y divide-rule">
            {[...rows]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((row) => (
                <li key={row.id} className="flex items-center gap-3 p-3">
                  {row.icon}
                  {row.link(linkClass)}
                  <span className="shrink-0 font-mono text-label text-ink-muted max-sm:hidden">
                    {row.meta}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${row.name} from bookmarked ${noun}`}
                    onClick={() => saved.toggleFavorite(row.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </section>
  )
}

const browseClass = cn(
  textLink,
  "inline-flex items-center gap-1.5 [&_svg]:size-4"
)

export function GemBookmarks() {
  const saved = useGemBookmarks()
  const catalogue = useGemCatalogue(saved.favorites.length > 0)
  const data = catalogue.data
  // A gem dropped from the catalogue keeps its row but is not listed.
  const rows: Row[] = data
    ? saved.favorites
        .filter((id) => Object.hasOwn(data.gems, id))
        .map((id) => {
          const reference = data.gems[id]
          return {
            id,
            name: reference.name,
            meta: reference.support ? "Support" : reference.type,
            icon: (
              <span
                className="grid size-8 shrink-0 place-items-center overflow-hidden border border-brand/40 bg-paper-deep text-ink-muted data-[support=true]:rounded-full [&_img]:size-full [&_img]:object-cover"
                data-support={reference.support}
              >
                {reference.image ? (
                  <img
                    src={reference.image}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                  />
                ) : (
                  <Diamond aria-hidden="true" />
                )}
              </span>
            ),
            link: (className) => (
              <Link
                className={className}
                to="/gems/$gem"
                params={{ gem: gemSlug(data, reference) }}
                search={{
                  ...defaultGemSearch,
                  gemLevel: undefined,
                  gemQuality: undefined,
                  advancedQuality: undefined,
                }}
              >
                {reference.name}
              </Link>
            ),
          }
        })
    : []
  return (
    <BookmarkList
      id="profile-gem-bookmarks"
      title="Bookmarked gems"
      description="Bookmarked skill and support gems lead the gems page."
      noun="gems"
      saved={saved}
      catalogue={catalogue}
      rows={rows}
      empty={
        <>
          <EmptyStateText>
            Bookmark gems on the gems page to find them here.
          </EmptyStateText>
          <Link to="/gems" search={defaultGemSearch} className={browseClass}>
            Browse gems
          </Link>
        </>
      }
    />
  )
}

const defaultItemSearch = itemSearch.parse({})

export function ItemBookmarks() {
  const saved = useItemBookmarks()
  const catalogue = useItemRegistry(saved.favorites.length > 0)
  const data = catalogue.data
  // An item dropped from the catalogue keeps its row but is not listed.
  const rows: Row[] = data
    ? saved.favorites
        .filter((slug) => Object.hasOwn(data.items, slug))
        .map((slug) => {
          const item = data.items[slug]
          const unique = item.kind === "unique"
          return {
            id: slug,
            name: item.name,
            meta: item.kind === "unique" ? item.baseName : item.itemClass,
            icon: (
              <span className="flex h-10 w-8 shrink-0 items-center justify-center [&_img]:h-full [&_img]:w-auto">
                <ItemRegistryImage src={item.image} />
              </span>
            ),
            link: (className) => (
              <Link
                className={
                  unique ? cn(className, "text-item-unique") : className
                }
                to="/items/$item"
                params={{ item: slug }}
                search={{
                  ...defaultItemSearch,
                  variant: undefined,
                  baseForm: undefined,
                }}
              >
                {item.name}
              </Link>
            ),
          }
        })
    : []
  return (
    <BookmarkList
      id="profile-item-bookmarks"
      title="Bookmarked items"
      description="Bookmarked uniques and bases lead the items page."
      noun="items"
      saved={saved}
      catalogue={catalogue}
      rows={rows}
      empty={
        <>
          <EmptyStateText>
            Bookmark items on the items page to find them here.
          </EmptyStateText>
          <Link to="/items" search={defaultItemSearch} className={browseClass}>
            Browse items
          </Link>
        </>
      }
    />
  )
}
