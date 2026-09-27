import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useMemo, useState } from "react"
import type { GemCatalogue, GemReference } from "../../shared/gems"
import type { GemSearch } from "../routes/gems"
import { findGems } from "../lib/gem-search"
import { useGemSearchIndex } from "../lib/use-gem-search-index"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/empty-state"
import { GemSection, GemSectionTitle } from "./gem-section"
import { GemResult } from "./gem-result"
import { GemSearchField } from "./gem-search-field"
import { Note } from "./ui/note"
import { TooltipPinScope } from "./tooltip-pins"

type Compatibility = {
  sourceRevision: string
  skills: string[]
  supports: Record<string, number[]>
}

const PAGE_SIZE = 60

export function CompatibleGems({
  gem,
  catalogue,
  search,
}: {
  gem: GemReference
  catalogue: GemCatalogue
  search: GemSearch
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query)
  const compatibility = useQuery<Compatibility>({
    queryKey: ["gem-support-compatibility", "v1"],
    queryFn: async () => {
      const response = await fetch("/gems/v1/support-compatibility.json")
      if (!response.ok) throw new Error("Gem compatibility unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
  const index = useGemSearchIndex()
  // The compatibility file lists skills by catalogue key, which differs from
  // gameId for many gems; match on skillId through the catalogue instead.
  const skillIndex = useMemo(
    () =>
      gem.support || !compatibility.data
        ? -1
        : compatibility.data.skills.findIndex(
            (key) =>
              key in catalogue.gems &&
              catalogue.gems[key].skillId === gem.skillId
          ),
    [catalogue, compatibility.data, gem]
  )
  const results = useMemo(() => {
    const data = compatibility.data
    if (!data) return []
    const references = gem.support
      ? (data.supports[gem.skillId] ?? []).flatMap((number) => {
          const key = data.skills[number]
          return key in catalogue.gems ? [catalogue.gems[key]] : []
        })
      : (() => {
          if (skillIndex < 0) return []
          const supportRefs = new Map(
            Object.values(catalogue.gems)
              .filter((reference) => reference.support)
              .map((reference) => [reference.skillId, reference])
          )
          return Object.entries(data.supports).flatMap(
            ([supportId, skills]) => {
              if (!skills.includes(skillIndex)) return []
              const reference = supportRefs.get(supportId)
              return reference ? [reference] : []
            }
          )
        })()
    return findGems(references, index.data, deferredQuery)
  }, [
    catalogue,
    compatibility.data,
    deferredQuery,
    gem,
    index.data,
    skillIndex,
  ])

  const heading = gem.support
    ? "Compatible skill gems"
    : "Compatible support gems"
  const missingCompatibility =
    compatibility.data &&
    (gem.support
      ? !(gem.skillId in compatibility.data.supports)
      : skillIndex < 0)

  return (
    <GemSection aria-labelledby="compatible-gems-title">
      <GemSectionTitle id="compatible-gems-title">{heading}</GemSectionTitle>
      <div className="px-[var(--shell-gutter)]">
        <GemSearchField
          id="compatible-gem-search"
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
          className="mt-5"
        />
      </div>
      {compatibility.isError ? (
        <Note className="mx-[var(--shell-gutter)] mt-5" role="alert">
          Compatible gems could not be loaded.
        </Note>
      ) : compatibility.isPending || index.isPending ? (
        <p
          className="px-[var(--shell-gutter)] py-8 text-sm text-ink-muted"
          role="status"
        >
          Loading compatible gems…
        </p>
      ) : missingCompatibility ? (
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
                      headers={catalogue.headers}
                      search={search}
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
