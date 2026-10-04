import { useDeferredValue, useMemo, useState } from "react"
import type { GemReference } from "../../shared/gems"
import type { GemSearch } from "../routes/gems"
import type { CompatibleGem } from "../../shared/gem-compatibility"
import { findGems } from "../lib/gem-search"
import { useGemSearchIndex } from "../lib/use-gem-search-index"
import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { useGemBookmarks } from "../lib/use-saved-list"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/empty-state"
import { GemSection, GemSectionTitle } from "./gem-section"
import { GemResult } from "./gem-result"
import { ReferenceSearchField } from "./reference-search-field"
import { Note } from "./ui/note"
import { TooltipPinScope } from "./tooltip-pins"

const PAGE_SIZE = 60

export function CompatibleGems({
  gem,
  references,
  search,
}: {
  gem: GemReference
  references: CompatibleGem[] | null
  search: GemSearch
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query)
  const index = useGemSearchIndex()
  // Enhance hover details after hydration; reference rows render from loader data.
  const catalogue = useGemCatalogue()
  const { favorites, toggleFavorite } = useGemBookmarks()
  const slugs = useMemo(
    () =>
      new Map(
        references?.map(({ reference, slug }) => [reference.skillId, slug])
      ),
    [references]
  )
  const results = useMemo(
    () =>
      findGems(
        references?.map(({ reference }) => reference) ?? [],
        index.data,
        deferredQuery
      ),
    [references, index.data, deferredQuery]
  )

  const heading = gem.support
    ? "Compatible skill gems"
    : "Compatible support gems"

  return (
    <GemSection aria-labelledby="compatible-gems-title">
      <GemSectionTitle id="compatible-gems-title">{heading}</GemSectionTitle>
      <div className="px-[var(--shell-gutter)]">
        <ReferenceSearchField
          label="Search gems"
          placeholder="Name, tag, description, or effect text"
          id="compatible-gem-search"
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
          className="mt-3"
        />
      </div>
      {references === null ? (
        <Note className="mx-[var(--shell-gutter)] mt-5" role="status">
          Compatibility data is unavailable for this gem.
        </Note>
      ) : (
        <TooltipPinScope maxPinnedTooltips={1}>
          {index.isError && (
            <Note className="mx-[var(--shell-gutter)] mt-4" role="status">
              Effect text could not be loaded. Names, tags, and descriptions
              remain searchable.
            </Note>
          )}
          {results.length ? (
            <>
              <ul className="mx-[var(--shell-gutter)] mt-4 mb-0 list-none border border-rule-strong bg-surface p-0">
                {results
                  .slice(0, page * PAGE_SIZE)
                  .map(({ reference, match }) => (
                    <GemResult
                      key={reference.gameId}
                      reference={reference}
                      match={match}
                      level={String(search.level)}
                      quality={String(search.quality)}
                      slug={slugs.get(reference.skillId)!}
                      headers={catalogue.data?.headers}
                      search={search}
                      bookmarked={favorites.includes(reference.gameId)}
                      onBookmarkedChange={() =>
                        toggleFavorite(reference.gameId)
                      }
                    />
                  ))}
              </ul>
              {page * PAGE_SIZE < results.length && (
                <div className="px-[var(--shell-gutter)]">
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Show more gems ({results.length - page * PAGE_SIZE}{" "}
                    remaining)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              frame="dashed"
              className="mx-[var(--shell-gutter)] mt-4"
            >
              No compatible gems match that search.
            </EmptyState>
          )}
        </TooltipPinScope>
      )}
    </GemSection>
  )
}
