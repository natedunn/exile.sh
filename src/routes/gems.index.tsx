import { createFileRoute } from "@tanstack/react-router"
import { shareMeta } from "../lib/share-meta"
import { gemSlug } from "../../shared/gem-slug"
import { useDeferredValue, useMemo } from "react"
import { GemResult } from "../components/gem-result"
import { GemSearchField } from "../components/gem-search-field"
import { TooltipPinScope } from "../components/tooltip-pins"
import { Button } from "../components/ui/button"
import { EmptyState } from "../components/ui/empty-state"
import { Field, FieldLabel } from "../components/ui/field"
import { Note } from "../components/ui/note"
import { NumberStepper } from "../components/ui/number-stepper"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "../components/ui/page-heading"
import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { findGems } from "../lib/gem-search"
import { useGemSearchIndex } from "../lib/use-gem-search-index"
import { useGemFavorites } from "../lib/use-saved-list"
import type { GemSearch } from "./gems"

export const Route = createFileRoute("/gems/")({
  head: () =>
    shareMeta({
      title: "PoE2 Skill & Support Gems",
      description:
        "Every Path of Exile 2 skill and support gem: level and quality ranges, effects, requirements and compatible supports.",
      path: "/gems",
      image: "/og/gems",
    }),
  component: GemsPage,
})

const PAGE_SIZE = 60
// One column on phones, up to three on wide screens.
const GRID = "m-0 grid list-none gap-2 p-0 md:grid-cols-2 xl:grid-cols-3"

function GemsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const catalogue = useGemCatalogue()
  const index = useGemSearchIndex()
  const { favorites, toggleFavorite, storageError } = useGemFavorites()
  const query = search.q
  const level = String(search.level)
  const quality = String(search.quality)
  const visible = search.page * PAGE_SIZE
  const patchSearch = (patch: Partial<GemSearch>) => {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace: true,
      resetScroll: false,
    })
  }
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const results = useMemo(() => {
    const references = Object.values(catalogue.data?.gems ?? {}).filter(
      (reference) => reference.name && reference.gameId
    )
    return findGems(references, index.data, deferredQuery)
  }, [catalogue.data, index.data, deferredQuery])
  const favoriteSet = new Set(favorites)
  // Favorites lead a search; with no search they have their own section.
  const ordered = deferredQuery
    ? [
        ...results.filter(({ reference }) => favoriteSet.has(reference.gameId)),
        ...results.filter(
          ({ reference }) => !favoriteSet.has(reference.gameId)
        ),
      ]
    : results
  const pinned = deferredQuery
    ? []
    : results.filter(({ reference }) => favoriteSet.has(reference.gameId))
  const renderGem = ({ reference, match }: (typeof results)[number]) =>
    catalogue.data && (
      <GemResult
        key={reference.gameId}
        reference={reference}
        match={match}
        level={level}
        quality={quality}
        slug={gemSlug(catalogue.data, reference)}
        headers={catalogue.data.headers}
        search={search}
        favorite={favoriteSet.has(reference.gameId)}
        onFavoriteChange={() => toggleFavorite(reference.gameId)}
        className="border border-rule-strong bg-surface last:border-b"
      />
    )

  return (
    <div className="pb-12">
      <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)]">
        <PageHeadingCopy>
          <PageTitle>Gems</PageTitle>
          <PageMeta>
            <span>Skills &amp; supports</span>
          </PageMeta>
        </PageHeadingCopy>
        <img
          src="/art/gems-masthead.png"
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
        <GemSearchField
          id="gem-search"
          value={query}
          onChange={(value) => patchSearch({ q: value, page: 1 })}
          className="max-w-180 min-w-0 flex-1 max-sm:basis-full"
        />
        <Field>
          <FieldLabel htmlFor="gem-level">Skill gem level</FieldLabel>
          <NumberStepper
            id="gem-level"
            label="Skill gem level"
            value={Number(level)}
            min={1}
            max={40}
            onValueChange={(value) => patchSearch({ level: value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="gem-quality">Gem quality</FieldLabel>
          <NumberStepper
            id="gem-quality"
            label="Gem quality"
            value={Number(quality)}
            min={0}
            max={62}
            suffix="%"
            onValueChange={(value) => patchSearch({ quality: value })}
          />
        </Field>
      </div>
      <div className="pt-4">
        {storageError && (
          <Note className="mt-4" role="status">
            Your browser could not save favorites. They will last only for this
            session.
          </Note>
        )}
        {index.isError && (
          <Note className="mt-4" role="status">
            Effect text could not be loaded. Names, tags, and descriptions
            remain searchable.
          </Note>
        )}
        {catalogue.isError ? (
          <Note className="mt-6" role="alert">
            Gem references could not be loaded.
          </Note>
        ) : catalogue.isPending || index.isPending ? (
          <p className="py-8 text-sm text-ink-muted" role="status">
            Loading gems…
          </p>
        ) : (
          <TooltipPinScope maxPinnedTooltips={1}>
            {pinned.length > 0 && (
              <section aria-labelledby="gem-favorites" className="mb-8">
                <div className="mt-6 flex items-baseline justify-between gap-3 border-b border-rule-strong pb-2">
                  <h2
                    id="gem-favorites"
                    className="font-display text-2xl text-ink"
                  >
                    Favorites
                  </h2>
                  <p className="font-mono text-label text-ink-muted">
                    {pinned.length} {pinned.length === 1 ? "gem" : "gems"}
                  </p>
                </div>
                <ul data-testid="gem-favorites" className={`${GRID} mt-3`}>
                  {pinned.map(renderGem)}
                </ul>
              </section>
            )}
            <div className="mt-6 flex items-baseline justify-between gap-3 border-b border-rule-strong pb-2">
              <h2 className="font-display text-2xl text-ink">
                {query.trim() ? "Results" : "All gems"}
              </h2>
              <p className="font-mono text-label text-ink-muted" role="status">
                {results.length} gems
              </p>
            </div>
            {results.length ? (
              <>
                <ul data-testid="gem-results" className={`${GRID} mt-3`}>
                  {ordered.slice(0, visible).map(renderGem)}
                </ul>
                {visible < results.length && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => patchSearch({ page: search.page + 1 })}
                  >
                    Show more gems ({results.length - visible} remaining)
                  </Button>
                )}
              </>
            ) : (
              <EmptyState frame="dashed" className="mt-4">
                No gems match that search.
              </EmptyState>
            )}
          </TooltipPinScope>
        )}
      </div>
    </div>
  )
}
