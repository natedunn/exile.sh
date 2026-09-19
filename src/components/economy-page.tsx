import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CircleHelp, Gem } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ANCHORS, QUOTES } from "../../shared/economy"
import type { ItemRow, Quote } from "../../shared/economy"
import { autoDisplayQuotes } from "../../shared/display-currency"
import { isEconomyStale } from "../../shared/freshness"
import { CategoryPicker, CategorySidebar } from "./economy/category-sidebar"
import { CurrencyTable } from "./economy/currency-table"
import { ItemDetail } from "./economy/market-detail"
import { MoversSection } from "./economy/movers"
import { EmptyAction } from "./economy/shared"
import { WorkspaceHeader } from "./economy/workspace-header"
import { StatusDot } from "./ui/badge"
import { EmptyState, EmptyStateText, EmptyStateTitle } from "./ui/empty-state"
import { Note } from "./ui/note"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "./ui/page-heading"
import { Panel } from "./ui/panel"
import { Skeleton } from "./ui/skeleton"
import { CATEGORIES, itemInfo } from "../lib/catalog"
import { useCRPC } from "../lib/convex/crpc"
import type { Filters } from "../lib/economy-filters"
import { utc } from "../lib/format"

export { filters, defaultFilters } from "../lib/economy-filters"
export type { Filters } from "../lib/economy-filters"

export function EconomyPage({
  f,
  patch,
  moversPage = false,
}: {
  f: Filters
  patch: (values: Partial<Filters>) => void
  moversPage?: boolean
}) {
  const crpc = useCRPC()
  const query = useQuery(
    crpc.economy.overview.queryOptions({ league: f.league })
  )
  const moverQuery = useQuery({
    ...crpc.economy.movers.queryOptions({ league: f.league, period: f.period }),
    enabled: moversPage && !f.item,
  })
  const [favorites, setFavorites] = useState<string[]>([])
  const [storageError, setStorageError] = useState(false)
  const [now, setNow] = useState(0)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        event.key.toLowerCase() !== "f" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !search.current ||
        target?.closest("input, textarea, select, [contenteditable]")
      )
        return
      event.preventDefault()
      search.current.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("exile.watchlist") ?? "[]"
      )
      if (Array.isArray(saved))
        setFavorites(
          saved.filter((value): value is string => typeof value === "string")
        )
    } catch {
      setStorageError(true)
    }
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem("exile.watchlist", JSON.stringify(next))
    } catch {
      setStorageError(true)
    }
  }

  const data = query.data
  const rows = data?.prices ?? []
  const categoryOptions = CATEGORIES.map((category) => {
    const categoryRows = rows.filter(
      (row) =>
        category === "All currencies" || itemInfo(row.id).category === category
    )
    const mostTraded = categoryRows.reduce<ItemRow | undefined>(
      (best, row) =>
        !best || row.volume * row.price > best.volume * best.price ? row : best,
      undefined
    )
    return { category, count: categoryRows.length, mostTraded }
  }).filter(({ category, count }) => count > 0 || category === "All currencies")

  const autoQuotes = autoDisplayQuotes(rows, data?.pairs ?? [])
  const displayQuote = (id: string): Quote =>
    f.quote === "Auto" ? (autoQuotes.get(id) ?? "Exalted") : f.quote
  const quoteIndex = (id: string) => QUOTES.indexOf(displayQuote(id))
  const rate = (id: string) =>
    displayQuote(id) === "Exalted"
      ? 1
      : rows.find((row) => row.id === ANCHORS[displayQuote(id)])?.price
  const value = (row: ItemRow) => {
    const conversion = rate(row.id)
    return conversion ? row.price / conversion : null
  }

  const visible = rows
    .filter((row) => {
      const item = itemInfo(row.id)
      return (
        (f.category === "All currencies" || item.category === f.category) &&
        item.name.toLowerCase().includes(f.q.toLowerCase()) &&
        (!f.favorites || favorites.includes(row.id))
      )
    })
    .sort((a, b) => {
      let difference = 0
      if (f.sort === "name")
        difference = itemInfo(a.id).name.localeCompare(itemInfo(b.id).name)
      else if (f.sort === "change") {
        const aValue = a.changes[quoteIndex(a.id)]
        const bValue = b.changes[quoteIndex(b.id)]
        if (aValue === null) return 1
        if (bValue === null) return -1
        difference = aValue - bValue
      } else {
        difference =
          f.sort === "volume"
            ? a.volume * a.price - b.volume * b.price
            : a.price - b.price
      }
      return (
        (f.dir === "asc" ? difference : -difference) || a.id.localeCompare(b.id)
      )
    })
  const pages = Math.max(1, Math.ceil(visible.length / 25))
  const page = Math.min(f.page, pages)
  const displayed = visible.slice((page - 1) * 25, page * 25)

  const metrics = new Map(
    (moverQuery.data?.hour === data?.hour &&
    moverQuery.data?.period === f.period
      ? moverQuery.data.rows
      : []
    ).map((row) => [row.id, row])
  )
  const moverChange = (row: ItemRow) =>
    metrics.get(row.id)?.changes[quoteIndex(row.id)] ?? null
  const movers = rows.filter(
    (row) =>
      metrics.get(row.id)?.eligible[quoteIndex(row.id)] &&
      moverChange(row) !== null
  )
  const rising = [...movers]
    .filter((row) => moverChange(row)! > 0)
    .sort(
      (a, b) => moverChange(b)! - moverChange(a)! || a.id.localeCompare(b.id)
    )
    .slice(0, 50)
  const falling = [...movers]
    .filter((row) => moverChange(row)! < 0)
    .sort(
      (a, b) => moverChange(a)! - moverChange(b)! || a.id.localeCompare(b.id)
    )
    .slice(0, 50)

  const stale = !!data && isEconomyStale(data.hour, now)
  const delayNotice =
    data && stale
      ? `Updates are delayed. Latest available data: ${utc(data.hour)}.`
      : undefined
  const openItem = (id: string) => patch({ item: id })

  return (
    <>
      <PageHeading
        compact={Boolean(f.item)}
        className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)]"
      >
        <PageHeadingCopy>
          <PageTitle>
            {moversPage ? "Market movers" : "Exchange economy"}
          </PageTitle>
          <PageMeta>
            <span>
              <strong>{f.league}</strong>
            </span>
            <span>
              {data
                ? `Updated ${utc(data.hour)}`
                : query.isPending
                  ? "Reading the market"
                  : "No completed hour yet"}
            </span>
          </PageMeta>
        </PageHeadingCopy>
        {!f.item && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-19 -right-4 z-0 size-85 select-none before:absolute before:-inset-20 before:bg-brand before:[mask-image:var(--dither-glow)] before:[mask-position:center] before:[mask-repeat:no-repeat] before:opacity-10 before:content-[''] max-xl:-top-12.5 max-xl:size-75 max-sm:-top-5 max-sm:-right-17.5 max-sm:size-50 max-sm:before:hidden"
          >
            <img
              src="/art/divine-dither.png"
              alt=""
              width="176"
              height="176"
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 size-full object-contain opacity-85 [image-rendering:pixelated] max-sm:opacity-45"
            />
          </div>
        )}
      </PageHeading>

      {storageError && (
        <Note
          size="sm"
          className="my-4 border border-brand-deep bg-notice px-4 py-3 text-brand-ink"
        >
          Your browser could not save favorites. They will last only for this
          session.
        </Note>
      )}

      <WorkspaceHeader
        f={f}
        patch={patch}
        moversPage={moversPage}
        delayNotice={delayNotice}
      />

      {query.isError ? (
        <EmptyState>
          <CircleHelp />
          <EmptyStateTitle>
            The market is temporarily unavailable.
          </EmptyStateTitle>
          <EmptyStateText>
            Your filters and favorites are safe. Try loading the data again.
          </EmptyStateText>
          <EmptyAction onClick={() => void query.refetch()}>Retry</EmptyAction>
        </EmptyState>
      ) : query.isPending ? (
        <div
          className="grid gap-3 py-16 mono-label text-ink-muted"
          role="status"
        >
          <span className="flex items-center gap-2">
            <StatusDot /> Reading the market…
          </span>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : !data ? (
        <EmptyState>
          <Gem />
          <EmptyStateTitle>No exchange data yet.</EmptyStateTitle>
          <EmptyStateText>
            No completed exchange hours have been imported for this league yet.
          </EmptyStateText>
          <Note>Choose another league or return after collection begins.</Note>
        </EmptyState>
      ) : f.item ? (
        <ItemDetail
          id={f.item}
          league={f.league}
          quote={displayQuote(f.item)}
          row={rows.find((row) => row.id === f.item)}
          price={
            rate(f.item)
              ? (rows.find((row) => row.id === f.item)?.price ?? 0) /
                rate(f.item)!
              : null
          }
          hour={data.hour}
          pairs={data.pairs}
          onBack={() => patch({ item: "" })}
          onItem={openItem}
          favorite={favorites.includes(f.item)}
          onFavorite={() => toggleFavorite(f.item)}
          range={f.range}
          onRange={(range) => patch({ range, page: f.page })}
        />
      ) : moversPage ? (
        <MoversSection
          f={f}
          patch={patch}
          status={
            moverQuery.isError
              ? "error"
              : moverQuery.isPending || moverQuery.data?.hour !== data.hour
                ? "loading"
                : "ready"
          }
          hasComparison={moverQuery.data?.hasComparison ?? false}
          rising={rising}
          falling={falling}
          change={moverChange}
          value={value}
          displayQuote={displayQuote}
          quoteIndex={quoteIndex}
          openItem={openItem}
          retry={() => void moverQuery.refetch()}
        />
      ) : (
        <div className="-mx-[var(--shell-gutter)] max-lg:mx-0 max-lg:grid max-lg:gap-4 max-lg:pt-6">
          <CategoryPicker f={f} patch={patch} options={categoryOptions} />
          <Panel
            surface="none"
            rule="none"
            className="grid grid-cols-[calc(224px+var(--shell-gutter))_minmax(0,1fr)] before:pointer-events-none before:absolute before:top-0 before:-bottom-8 before:left-[calc(224px+var(--shell-gutter))] before:z-1 before:border-l before:border-rule-strong before:content-[''] max-lg:block max-lg:before:hidden"
          >
            <CategorySidebar
              f={f}
              patch={patch}
              options={categoryOptions}
              hour={data.hour}
              now={now}
              favoriteCount={
                rows.filter((row) => favorites.includes(row.id)).length
              }
              delayNotice={delayNotice}
            />
            <div className="min-w-0">
              <CurrencyTable
                f={f}
                patch={patch}
                search={search}
                displayed={displayed}
                total={visible.length}
                page={page}
                pages={pages}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                displayQuote={displayQuote}
                quoteIndex={quoteIndex}
                value={value}
                openItem={openItem}
              />
            </div>
          </Panel>
        </div>
      )}

      <Note
        rule="top"
        className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] [&_a]:text-brand-ink [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-4 [&>svg]:text-brand"
      >
        <CircleHelp size={15} />
        <span>
          Prices reflect completed exchange trades, not live offers. Thin
          markets can be volatile.{" "}
          <Link to="/methodology" search={f}>
            Read the methodology.
          </Link>
        </span>
      </Note>
    </>
  )
}
