import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  Star,
} from "lucide-react"
import { lazy, Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { EmptyState } from "@/components/ui/empty-state"
import { LabelText } from "@/components/ui/label"
import { Panel } from "@/components/ui/panel"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import { QUOTES } from "../../../shared/economy"
import type { ItemRow, Pair, Quote } from "../../../shared/economy"
import { itemInfo } from "../../lib/catalog"
import { useCRPC } from "../../lib/convex/crpc"
import type { ChartRange, Filters } from "../../lib/economy-filters"
import { CHART_RANGE_DAYS, CHART_RANGES } from "../../lib/economy-filters"
import { compact, number, utc } from "../../lib/format"
import { headCell } from "./currency-table"
import { Delta, Icon } from "./icon"
import {
  EmptyAction,
  PageButtons,
  Pagination,
  SearchField,
  SectionHeading,
  TableFrame,
  TableToolbar,
} from "./shared"

const MarketChart = lazy(() => import("../market-chart"))

const stat =
  "min-w-0 border-l border-dotted border-rule-strong pl-4 first:border-l-0 first:pl-0"
const figureLarge =
  "block text-3xl leading-[1.1] font-medium text-ink figure max-sm:text-xl"

export function ItemDetail({
  id,
  league,
  quote,
  row,
  price,
  hour,
  pairs,
  onBack,
  onItem,
  favorite,
  onFavorite,
  range,
  onRange,
}: {
  id: string
  league: Filters["league"]
  quote: Quote
  row?: ItemRow
  price: number | null
  hour: number
  pairs: Pair[]
  onBack: () => void
  onItem: (id: string) => void
  favorite: boolean
  onFavorite: () => void
  range: ChartRange
  onRange: (range: ChartRange) => void
}) {
  const days = CHART_RANGE_DAYS[range]
  const crpc = useCRPC(),
    query = useQuery(
      crpc.economy.itemHistory.queryOptions({ league, item: id, quote, days })
    )
  const info = itemInfo(id),
    qi = QUOTES.indexOf(quote)
  const points = query.data?.points ?? []
  return (
    <section data-testid="detail-view">
      <Button
        variant="ghost"
        size="bare"
        className="my-6 mono-label text-ink-muted hover:bg-transparent hover:text-ink"
        onClick={onBack}
      >
        <ChevronLeft size={14} /> Back to market
      </Button>
      <div className="flex items-center gap-6 max-lg:grid max-lg:grid-cols-[72px_minmax(0,1fr)] max-lg:items-start max-lg:gap-4 max-sm:gap-2">
        <Icon id={id} size="large" />
        <div>
          <h2 className="mb-2 display text-5xl text-ink max-lg:text-4xl max-sm:text-3xl">
            {info.name}
          </h2>
          <p className="max-w-[62ch] text-sm leading-relaxed text-ink-muted">
            {info.description}
          </p>
        </div>
        <Toggle
          size="sm"
          className="ml-auto inline-flex h-9 items-center gap-2 rounded border border-rule-strong bg-surface px-3 font-mono text-xs text-ink-muted hover:border-brand-deep hover:bg-surface hover:text-ink aria-pressed:border-brand-deep aria-pressed:bg-notice aria-pressed:text-brand data-[state=on]:bg-notice max-lg:col-start-2 max-lg:m-0 max-lg:min-h-11 max-lg:justify-self-start"
          pressed={favorite}
          onPressedChange={onFavorite}
        >
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Watching" : "Watch currency"}
        </Toggle>
      </div>
      <div
        data-testid="detail-stats"
        className="my-8 grid grid-cols-4 gap-6 border-t border-b border-rule border-t-rule-strong py-6 max-lg:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-6 max-lg:[&>:nth-child(3)]:border-l-0 max-lg:[&>:nth-child(3)]:pl-0"
      >
        <div className={stat}>
          <LabelText className="mb-2 flex">Executed average</LabelText>
          <strong className={figureLarge}>
            {row && price !== null ? number(price) : "—"}{" "}
            <small className="ml-0.5 text-xs text-ink-muted">{quote}</small>
          </strong>
        </div>
        <div className={stat}>
          <LabelText className="mb-2 flex">24-hour change</LabelText>
          <strong className={figureLarge}>
            <Delta
              value={row?.changes[qi] ?? null}
              className="gap-1 text-3xl max-sm:text-xl [&_svg]:size-5"
            />
          </strong>
        </div>
        <div className={stat}>
          <LabelText className="mb-2 flex">Hourly traded units</LabelText>
          <strong className={figureLarge}>
            {row ? compact(row.volume) : "—"}
          </strong>
        </div>
        <div className={stat}>
          <LabelText className="mb-2 flex">Observation</LabelText>
          <span className="figure text-sm text-ink">{utc(hour)}</span>
          <small className="mt-2 block text-xs text-ink-muted">
            {row?.direct
              ? "Direct Exalted market"
              : "Derived through an anchor currency"}
          </small>
        </div>
      </div>
      <Panel rule="default" fade="brand">
        <div className="flex items-center justify-between gap-4 px-6 py-4 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:p-4">
          <h3 className="display text-2xl text-ink">Price history</h3>
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
        {query.isError ? (
          <EmptyState size="chart">
            <p>History could not be loaded.</p>
            <EmptyAction
              onClick={() => {
                void query.refetch()
              }}
            >
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
        <div
          data-testid="history-caption"
          className="border-t border-rule px-6 py-3 font-mono text-label leading-[1.8] font-medium tracking-[0.02em] text-ink-muted max-sm:px-4"
        >
          {points.length
            ? `${points.length} ${days > 7 ? "daily" : "hourly"} observations · Available from ${utc(points[0][0])}`
            : "History appears as completed hours are collected."}{" "}
          · Gaps are not interpolated.
        </div>
      </Panel>
      <Collapsible data-testid="history-data" className="py-3">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="bare"
              className="mt-2 mb-3 mono-label text-ink-muted hover:bg-transparent hover:text-ink"
            />
          }
        >
          View chart data
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TableFrame
            hint="history"
            className="[&_[data-slot=table-container]]:max-h-75 [&_[data-slot=table-container]]:overflow-auto"
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
      <div className="flex gap-6 pt-3 pb-8 font-mono text-xs text-brand-ink max-sm:flex-col max-sm:gap-3">
        <a
          className="flex items-center gap-2 border-b border-dotted border-brand-deep hover:text-brand max-sm:self-start"
          href={`https://www.poe2wiki.net/wiki/${encodeURIComponent(info.name.replaceAll(" ", "_"))}`}
          target="_blank"
          rel="noreferrer"
        >
          Read on PoE2 Wiki <ExternalLink size={12} />
        </a>
        <a
          className="flex items-center gap-2 border-b border-dotted border-brand-deep hover:text-brand max-sm:self-start"
          href="https://www.pathofexile.com/trade2"
          target="_blank"
          rel="noreferrer"
        >
          Open official trade <ExternalLink size={12} />
        </a>
      </div>
      <PairTable
        pairs={pairs.filter((p) => p.a === id || p.b === id)}
        onItem={onItem}
      />
    </section>
  )
}

const pairCell = "p-4 text-xs figure"
const pairButton =
  "h-auto justify-start gap-2 bg-transparent px-0 py-1 font-sans text-sm text-ink hover:bg-transparent hover:text-brand max-sm:max-w-50 max-sm:overflow-hidden max-sm:text-ellipsis"

function PairTable({
  pairs,
  onItem,
}: {
  pairs: Pair[]
  onItem: (id: string) => void
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [inverted, setInverted] = useState(false)
  const visible = pairs
    .filter((p) =>
      `${itemInfo(p.a).name} ${itemInfo(p.b).name}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
    .sort((a, b) => b.va - a.va)
  const current = Math.min(page, Math.max(1, Math.ceil(visible.length / 20)))
  return (
    <section className="mt-6">
      <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-wrap">
        <SectionHeading>Exchange pairs</SectionHeading>
        <Button
          variant="outline"
          size="sm"
          className="h-8.5 px-3 font-mono text-xs text-ink-muted aria-pressed:border-brand-deep aria-pressed:text-brand"
          aria-pressed={inverted}
          onClick={() => setInverted(!inverted)}
        >
          <ArrowLeftRight size={14} /> Invert pairs
        </Button>
      </div>
      <TableToolbar className="pb-6">
        <SearchField
          aria-label="Search exchange pairs"
          placeholder="Search either currency…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </TableToolbar>
      <TableFrame hint="pairs">
        <Table
          data-testid="pairs-table"
          className="min-w-187.5 border-collapse text-left"
          scrollLabel="Exchange pairs, scroll horizontally for more columns"
        >
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className={cn(headCell, "p-4")}>
                Currency pair
              </TableHead>
              <TableHead className={cn(headCell, "p-4")}>
                Average rate
              </TableHead>
              <TableHead className={cn(headCell, "p-4")}>
                Traded units
              </TableHead>
              <TableHead className={cn(headCell, "p-4")}>
                Hourly high stock
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.slice((current - 1) * 20, current * 20).map((p) => {
              const a = inverted ? p.b : p.a,
                b = inverted ? p.a : p.b,
                va = inverted ? p.vb : p.va,
                vb = inverted ? p.va : p.vb
              return (
                <TableRow key={p.id} className="border-rule">
                  <TableCell className={pairCell}>
                    <div className="grid grid-cols-[max-content_auto_max-content] items-center justify-start gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={pairButton}
                        onClick={() => onItem(a)}
                      >
                        <Icon id={a} size="pair" />
                        {itemInfo(a).name}
                      </Button>
                      <ArrowRight size={12} className="text-ink-faint" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className={pairButton}
                        onClick={() => onItem(b)}
                      >
                        <Icon id={b} size="pair" />
                        {itemInfo(b).name}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className={pairCell}>
                    {va > 0 && vb > 0 ? `${number(vb / va)} : 1` : "No trades"}
                  </TableCell>
                  <TableCell className={pairCell}>
                    {compact(va)} / {compact(vb)}
                  </TableCell>
                  <TableCell className={pairCell}>
                    {compact(inverted ? p.sb : p.sa)} /{" "}
                    {compact(inverted ? p.sa : p.sb)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableFrame>
      {!visible.length && (
        <EmptyState size="chart">No matching pairs.</EmptyState>
      )}
      <Pagination className="[&>span]:max-w-none [&>span]:leading-relaxed max-sm:[&>span]:basis-full">
        <span>
          Historical stock, not live offers. Rates are units of the second
          currency per one of the first.
        </span>
        <PageButtons
          previous={current > 1}
          next={current * 20 < visible.length}
          onPrevious={() => setPage(current - 1)}
          onNext={() => setPage(current + 1)}
          labels={["Previous pairs", "Next pairs"]}
        />
      </Pagination>
    </section>
  )
}
