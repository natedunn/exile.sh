import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ExternalLink, Star } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { EmptyState } from "@/components/ui/empty-state"
import { Note } from "@/components/ui/note"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "@/components/ui/page-heading"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { currencySlug } from "../../../shared/currency-slug"
import { ANCHORS } from "../../../shared/economy"
import type { ItemRow, Pair, Quote } from "../../../shared/economy"
import { isEconomyStale } from "../../../shared/freshness"
import { itemInfo, plainDescription } from "../../lib/catalog"
import { useCRPC } from "../../lib/convex/crpc"
import type { ChartRange, Filters } from "../../lib/economy-filters"
import { CHART_RANGE_DAYS, CHART_RANGES } from "../../lib/economy-filters"
import { compact, number, utc } from "../../lib/format"
import { useMarket } from "../../lib/use-market"
import { useWatchlist } from "../../lib/use-watchlist"
import { StatsList, StatsRow, StatsSection } from "../build/stats-ledger"
import { GemSection, GemSectionTitle } from "../gem-section"
import { headCell } from "./currency-table"
import { Delta, Icon } from "./icon"
import { EmptyAction, TableFrame } from "./shared"
import { DisplayCurrencySelect, LeagueSelect } from "./workspace-header"

const MarketChart = lazy(() => import("../market-chart"))

const externalLink =
  "flex items-center gap-2 self-start border-b border-dotted border-brand-deep font-mono text-xs text-brand-ink hover:text-brand"

export function CurrencyPage({
  id,
  f,
  patch,
}: {
  id: string | undefined
  f: Filters
  patch: (values: Partial<Filters>) => void
}) {
  const { query, rows, displayQuote, quoteIndex, value } = useMarket(f)
  const { favorites, toggleFavorite, storageError } = useWatchlist()
  const info = id ? itemInfo(id) : undefined
  const row = id ? rows.find((r) => r.id === id) : undefined
  const data = query.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeading className="-mx-[var(--shell-gutter)] min-h-0 px-[var(--shell-gutter)] pb-6 max-lg:flex-wrap">
        <div className="relative z-1 flex min-w-0 items-center gap-6 max-sm:gap-4">
          {id && <Icon id={id} size="large" className="max-sm:hidden" />}
          <PageHeadingCopy>
            <PageTitle>{info?.name ?? "Currency"}</PageTitle>
            <PageMeta>
              {info && (
                <span>
                  <strong>{info.category}</strong>
                </span>
              )}
              <span>{f.league}</span>
              {data && <span>Updated {utc(data.hour)}</span>}
            </PageMeta>
          </PageHeadingCopy>
        </div>
        {info?.icon && (
          // The item's own art, dithered into the masthead the way gem
          // pages carry theirs.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden [mask-image:var(--dither-glow-masthead)] [mask-size:100%_100%] [mask-repeat:no-repeat] opacity-60 max-sm:w-2/3 max-sm:opacity-30"
          >
            <img
              src={info.icon}
              alt=""
              className="absolute top-1/2 left-[68%] aspect-square h-[140%] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,black_45%,transparent)] brightness-125 contrast-125 grayscale saturate-200 sepia [image-rendering:pixelated]"
            />
            <div className="absolute inset-0 dot-screen text-brand/15" />
          </div>
        )}
        {id && row && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={favorites.includes(id)}
            className="relative z-1 ml-auto shrink-0 bg-paper aria-pressed:border-brand-deep aria-pressed:bg-notice aria-pressed:text-brand"
            onClick={() => toggleFavorite(id)}
          >
            <Star
              aria-hidden="true"
              fill={favorites.includes(id) ? "currentColor" : "none"}
            />
            {favorites.includes(id) ? "Watching" : "Watch"}
          </Button>
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

      {query.isError ? (
        <EmptyState className="mt-8">
          <p>The market is temporarily unavailable.</p>
          <EmptyAction onClick={() => void query.refetch()}>Retry</EmptyAction>
        </EmptyState>
      ) : query.isPending ? (
        <div className="grid gap-3 py-12" role="status">
          <span className="sr-only">Reading the market…</span>
          <Skeleton className="h-80" />
          <Skeleton className="h-12" />
        </div>
      ) : !id || !info ? (
        <EmptyState frame="dashed" className="mt-8">
          <p>No currency by that name.</p>
          <Link
            to="/economy/market"
            search={f}
            className="text-brand underline"
          >
            Back to the currency market
          </Link>
        </EmptyState>
      ) : (
        <div className="-mx-[var(--shell-gutter)] grid min-w-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div
            data-testid="detail-view"
            className="min-w-0 lg:border-r lg:border-rule-strong"
          >
            {info.description && (
              <GemSection
                aria-labelledby="currency-description-title"
                className="pb-0 lg:border-b-0"
              >
                <GemSectionTitle id="currency-description-title">
                  Description
                </GemSectionTitle>
                <p className="mt-2 max-w-[62ch] px-[var(--shell-gutter)] font-display text-xl leading-relaxed text-ink-soft">
                  {plainDescription(info.description)}
                </p>
              </GemSection>
            )}
            <PriceHistory
              id={id}
              league={f.league}
              quote={displayQuote(id)}
              range={f.range}
              onRange={(range) => patch({ range })}
            />
            {data && (
              <TradesAgainst
                id={id}
                pairs={data.pairs.filter((p) => p.a === id || p.b === id)}
                f={f}
              />
            )}
          </div>
          <aside className="min-w-0 max-lg:order-first max-lg:border-b max-lg:border-rule-strong">
            <GemSection aria-labelledby="currency-view-title" className="py-6">
              <GemSectionTitle id="currency-view-title">View</GemSectionTitle>
              <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-[var(--shell-gutter)] [&_[data-slot=select-trigger]]:w-full">
                <LeagueSelect
                  league={f.league}
                  onLeague={(league) => patch({ league })}
                />
                <DisplayCurrencySelect
                  quote={f.quote}
                  onQuote={(quote) => patch({ quote })}
                />
              </div>
            </GemSection>
            <MarketFigures
              row={row}
              price={row ? value(row) : null}
              quote={displayQuote(id)}
              qi={quoteIndex(id)}
              hour={data?.hour}
            />
            <GemSection
              aria-labelledby="currency-links-title"
              className="py-6 max-lg:hidden"
            >
              <GemSectionTitle id="currency-links-title">
                Elsewhere
              </GemSectionTitle>
              <ExternalLinks name={info.name} f={f} />
            </GemSection>
          </aside>
          <div className="px-[var(--shell-gutter)] py-6 lg:hidden">
            <ExternalLinks name={info.name} f={f} />
          </div>
        </div>
      )}
    </div>
  )
}

function ExternalLinks({ name, f }: { name: string; f: Filters }) {
  return (
    <div className="mt-4 flex flex-col gap-3 px-[var(--shell-gutter)] max-lg:flex-row max-lg:flex-wrap max-lg:gap-6 max-lg:px-0">
      <a
        className={externalLink}
        href={`https://www.poe2wiki.net/wiki/${encodeURIComponent(name.replaceAll(" ", "_"))}`}
        target="_blank"
        rel="noreferrer"
      >
        Read on PoE2 Wiki <ExternalLink size={12} />
      </a>
      <a
        className={externalLink}
        href="https://www.pathofexile.com/trade2"
        target="_blank"
        rel="noreferrer"
      >
        Open official trade <ExternalLink size={12} />
      </a>
      <Link to="/methodology" search={f} className={externalLink}>
        How prices are measured
      </Link>
    </div>
  )
}

function MarketFigures({
  row,
  price,
  quote,
  qi,
  hour,
}: {
  row: ItemRow | undefined
  price: number | null
  quote: Quote
  qi: number
  hour: number | undefined
}) {
  // Read the clock after hydration so server and client markup agree.
  const [now, setNow] = useState(0)
  useEffect(() => setNow(Date.now()), [])
  const stale = hour !== undefined && now > 0 && isEconomyStale(hour, now)
  return (
    <GemSection aria-labelledby="currency-market-title" className="py-6">
      <GemSectionTitle id="currency-market-title">Market</GemSectionTitle>
      <div data-testid="detail-stats" className="px-[var(--shell-gutter)]">
        {row ? (
          <>
            <p className="mt-4 flex items-center gap-3">
              <strong className="figure text-4xl leading-none font-medium text-ink max-sm:text-3xl">
                {price === null ? "—" : number(price)}
              </strong>
              <span className="inline-flex items-center gap-1.5 mono-label text-ink-muted">
                <Icon id={ANCHORS[quote]} size="sm" />
                {quote}
              </span>
            </p>
            <p className="mt-2 mb-4 text-xs text-ink-muted">
              Executed average, last completed hour
            </p>
            <StatsSection>
              <StatsList>
                <StatsRow label="24-hour change">
                  <Delta value={row.changes[qi]} />
                </StatsRow>
                <StatsRow label="7-day change">
                  <Delta value={row.changes7[qi]} />
                </StatsRow>
                <StatsRow label="Traded this hour">
                  <span className="figure">{compact(row.volume)} units</span>
                </StatsRow>
                <StatsRow label="Priced">
                  {row.direct ? "Against Exalted" : "Through an anchor"}
                </StatsRow>
                {hour !== undefined && (
                  <StatsRow label="Observed">
                    <span
                      className={cn("figure", stale && "text-brand")}
                      title={stale ? "Updates are delayed." : undefined}
                    >
                      {utc(hour)}
                    </span>
                  </StatsRow>
                )}
              </StatsList>
            </StatsSection>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            No completed trades in this league’s latest hour.
          </p>
        )}
      </div>
    </GemSection>
  )
}

function PriceHistory({
  id,
  league,
  quote,
  range,
  onRange,
}: {
  id: string
  league: Filters["league"]
  quote: Quote
  range: ChartRange
  onRange: (range: ChartRange) => void
}) {
  const days = CHART_RANGE_DAYS[range]
  const crpc = useCRPC()
  const query = useQuery(
    crpc.economy.itemHistory.queryOptions({ league, item: id, quote, days })
  )
  const points = query.data?.points ?? []
  return (
    <GemSection aria-labelledby="currency-history-title">
      <div className="flex items-center gap-4 px-[var(--shell-gutter)]">
        <GemSectionTitle id="currency-history-title" className="flex-1 px-0">
          Price history
        </GemSectionTitle>
        <SegmentedControl className="bg-paper [&>*+*]:border-rule">
          {CHART_RANGES.map((r) => (
            <SegmentedControlItem
              size="default"
              key={r}
              className="px-3 max-lg:min-h-11"
              active={range === r}
              onClick={() => onRange(r)}
            >
              {r.toUpperCase()}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      <div className="mt-4 px-[calc(var(--shell-gutter)-var(--spacing)*3)]">
        {query.isError ? (
          <EmptyState size="chart">
            <p>History could not be loaded.</p>
            <EmptyAction onClick={() => void query.refetch()}>
              Retry
            </EmptyAction>
          </EmptyState>
        ) : query.isPending ? (
          <EmptyState size="chart" role="status">
            Loading history…
          </EmptyState>
        ) : (
          <Suspense
            fallback={<EmptyState size="chart">Loading chart…</EmptyState>}
          >
            <MarketChart points={points} quote={quote} daily={days > 7} />
          </Suspense>
        )}
      </div>
      <Collapsible data-testid="history-data" className="mt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-[var(--shell-gutter)]">
          <p
            data-testid="history-caption"
            className="font-mono text-label leading-[1.8] tracking-[0.02em] text-ink-faint"
          >
            {points.length
              ? `${points.length} ${days > 7 ? "daily" : "hourly"} observations since ${utc(points[0][0])}`
              : "History appears as completed hours are collected."}{" "}
            · Gaps are not interpolated.
          </p>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="bare"
                className="mono-label text-ink-muted hover:bg-transparent hover:text-ink"
              />
            }
          >
            View chart data
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <TableFrame
            hint="history"
            className="mt-4 px-[var(--shell-gutter)] [&_[data-slot=table-container]]:max-h-75 [&_[data-slot=table-container]]:overflow-auto"
          >
            <Table
              className="min-w-145 border-collapse text-left"
              scrollLabel="Price history data, scroll horizontally for more columns"
            >
              <TableHeader className="[&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className={headCell}>Time (UTC)</TableHead>
                  <TableHead className={headCell}>Price ({quote})</TableHead>
                  <TableHead className={headCell}>Traded units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p[0]} className="border-rule">
                    <TableCell className="p-3 figure text-xs text-ink">
                      {utc(p[0])}
                    </TableCell>
                    <TableCell className="p-3 figure text-xs text-ink">
                      {number(p[1])}
                    </TableCell>
                    <TableCell className="p-3 figure text-xs text-ink">
                      {number(p[2], 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        </CollapsibleContent>
      </Collapsible>
    </GemSection>
  )
}

const PAIR_PREVIEW = 8

/* Each market this currency traded in last hour, seen from its side: the
   other currency, the rate written whichever way reads as a whole number,
   and how much of this currency's trade went through that market. The
   share also fills the row behind it, like depth on an order book. */
function TradesAgainst({
  id,
  pairs,
  f,
}: {
  id: string
  pairs: Pair[]
  f: Filters
}) {
  const [expanded, setExpanded] = useState(false)
  const markets = pairs
    .map((p) => {
      const mine = p.a === id
      return {
        key: p.id,
        other: mine ? p.b : p.a,
        units: mine ? p.va : p.vb,
        otherUnits: mine ? p.vb : p.va,
        stock: mine ? p.sa : p.sb,
      }
    })
    .sort((a, b) => b.units - a.units)
  const total = markets.reduce((sum, m) => sum + m.units, 0)
  const shown = expanded ? markets : markets.slice(0, PAIR_PREVIEW)
  const name = itemInfo(id).name
  const columns =
    "grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,auto)_4.5rem_5rem] items-center gap-4 max-sm:grid-cols-[minmax(0,1fr)_auto]"

  return (
    <GemSection aria-labelledby="currency-pairs-title">
      <GemSectionTitle id="currency-pairs-title">
        Trades against
      </GemSectionTitle>
      {markets.length === 0 ? (
        <p className="mt-4 px-[var(--shell-gutter)] text-sm text-ink-muted">
          No markets traded {name} in the latest hour.
        </p>
      ) : (
        <>
          <div
            className={cn(
              columns,
              "mt-4 border-b border-rule px-[var(--shell-gutter)] pb-2 mono-label text-ink-faint"
            )}
          >
            <span>Currency</span>
            <span>Rate</span>
            <HeadHint
              label="Share"
              hint={`The part of this hour’s ${name} trade that went through each market.`}
            />
            <HeadHint
              label="Stock"
              hint={`The most ${name} listed in each market during the hour.`}
            />
          </div>
          <ol data-testid="pairs-table">
            {shown.map((m) => {
              const share = total ? m.units / total : 0
              return (
                <li key={m.key} data-testid="pair-row">
                  <Link
                    to="/currency/$slug"
                    params={{ slug: currencySlug(m.other) }}
                    search={f}
                    className={cn(
                      columns,
                      "group/pair relative isolate min-h-14 border-b border-rule px-[var(--shell-gutter)] py-2.5 text-sm text-ink no-underline hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 -z-1 bg-brand/6 transition-colors group-hover/pair:bg-brand/10"
                      style={{ width: `${share * 100}%` }}
                    />
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon id={m.other} size="pair" />
                      <span className="truncate group-hover/pair:underline group-hover/pair:decoration-dotted group-hover/pair:underline-offset-4">
                        {itemInfo(m.other).name}
                      </span>
                    </span>
                    <Rate
                      id={id}
                      other={m.other}
                      units={m.units}
                      otherUnits={m.otherUnits}
                    />
                    <span className="figure text-xs text-ink-muted max-sm:hidden">
                      {share >= 0.001
                        ? `${number(share * 100, share < 0.1 ? 1 : 0)}%`
                        : "<0.1%"}
                    </span>
                    <span className="figure text-xs text-ink-faint max-sm:hidden">
                      {compact(m.stock)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-4 px-[var(--shell-gutter)] pt-4 font-mono text-label tracking-[0.02em] text-ink-faint">
            <span>
              {markets.length} {markets.length === 1 ? "market" : "markets"} ·
              last completed hour · not live offers
            </span>
            {markets.length > PAIR_PREVIEW && (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show fewer" : `Show all ${markets.length} markets`}
              </Button>
            )}
          </div>
        </>
      )}
    </GemSection>
  )
}

/* "1 [A] = 12.5 [B]", turned so the figure is at least one. */
function Rate({
  id,
  other,
  units,
  otherUnits,
}: {
  id: string
  other: string
  units: number
  otherUnits: number
}) {
  if (!(units > 0 && otherUnits > 0))
    return <span className="figure text-xs text-ink-faint">No trades</span>
  const flip = otherUnits / units < 1
  const [one, many] = flip ? [other, id] : [id, other]
  const figure = flip ? units / otherUnits : otherUnits / units
  const words = `1 ${itemInfo(one).name} = ${number(figure)} ${itemInfo(many).name}`
  return (
    <span
      className="inline-flex items-center gap-1.5 figure text-sm whitespace-nowrap text-ink"
      title={words}
    >
      <span className="sr-only">{words}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1.5">
        1 <Icon id={one} size="xs" />
        <span className="text-ink-faint">=</span>
        {number(figure)} <Icon id={many} size="xs" />
      </span>
    </span>
  )
}

function HeadHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        className="justify-self-start underline decoration-dotted underline-offset-4 max-sm:hidden"
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
