import { SiteNavigation } from "./site-navigation"
import { Button } from "../components/ui/button"
import { isEconomyStale } from "../../shared/freshness"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip"
import { Skeleton } from "../components/ui/skeleton"
import { Toggle } from "../components/ui/toggle"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useState } from "react"
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Search,
  Shuffle,
  Star,
  X,
  SlidersHorizontal,
  ArrowLeftRight,
  Gem,
} from "lucide-react"
import type { Filters } from "../lib/economy-filters"
import { useCRPC } from "../lib/convex/crpc"
import { CATEGORIES, itemInfo } from "../lib/catalog"
import { compact, number, percent, utc } from "../lib/format"
import { ANCHORS, QUOTES } from "../../shared/economy"
import type { ItemRow, Pair, Quote } from "../../shared/economy"

import {
  autoDisplayQuotes,
  DISPLAY_CURRENCIES,
} from "../../shared/display-currency"

import { MOVER_PERIODS, MOVER_PERIOD } from "../../shared/movers"

const MarketChart = lazy(() => import("../components/market-chart"))
export { filters, defaultFilters } from "../lib/economy-filters"
export type { Filters } from "../lib/economy-filters"

function Icon({
  id,
  large = false,
  glow = false,
}: {
  id: string
  large?: boolean
  glow?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const item = itemInfo(id)
  return (
    <span className={`item-icon ${large ? "large" : ""}`}>
      {glow && item.icon && !broken && (
        <img
          className="item-icon-glow"
          src={item.icon}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={32}
          height={32}
        />
      )}
      {item.icon && !broken ? (
        <img
          src={item.icon}
          onError={() => setBroken(true)}
          alt=""
          loading="lazy"
          width={large ? 58 : 32}
          height={large ? 58 : 32}
        />
      ) : (
        <Gem size={large ? 30 : 19} />
      )}
    </span>
  )
}
function DisplayCurrencyLabel({ quote }: { quote: Filters["quote"] }) {
  return (
    <span className="display-currency-label">
      {quote === "Auto" ? (
        <Shuffle size={18} aria-hidden="true" />
      ) : (
        <Icon id={ANCHORS[quote]} />
      )}
      {quote}
    </span>
  )
}
function Delta({ value }: { value: number | null }) {
  return (
    <span
      className={`delta ${value === null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative"}`}
    >
      {value !== null &&
        value !== 0 &&
        (value > 0 ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />)}
      {percent(value)}
    </span>
  )
}
function Sparkline({
  values,
  alignStart = false,
}: {
  values: (number | null)[]
  alignStart?: boolean
}) {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2)
    return <span className="muted small">Collecting history</span>
  const min = Math.min(...valid),
    max = Math.max(...valid),
    range = max - min || max * 0.1 || 1
  const up = valid.at(-1)! >= valid[0]
  let path = "",
    connected = false
  values.forEach((v, i) => {
    if (v === null) {
      connected = false
      return
    }
    path += `${connected ? "L" : "M"}${(i * 100) / (values.length - 1)},${28 - ((v - min) / range) * 23} `
    connected = true
  })
  return (
    <svg
      className={`sparkline ${up ? "positive" : "negative"}`}
      viewBox={`${alignStart ? (values.findIndex((value) => value !== null) * 100) / (values.length - 1) : 0} 0 100 32`}
      preserveAspectRatio="xMinYMid meet"
      aria-label={`${up ? "Rising" : "Falling"} over available 48-hour history`}
      role="img"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

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
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("exile.watchlist") ?? "[]"
      )
      if (Array.isArray(saved))
        setFavorites(saved.filter((s): s is string => typeof s === "string"))
    } catch {
      setStorageError(true)
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((v) => v !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem("exile.watchlist", JSON.stringify(next))
    } catch {
      setStorageError(true)
    }
  }
  const data = query.data,
    rows = data?.prices ?? []
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
  const categoryLabel = (category: string) => {
    const item = categoryOptions.find(
      (option) => option.category === category
    )?.mostTraded
    return (
      <span className="category-option-label">
        {category === "Watchlist" ? (
          <Star size={22} aria-hidden="true" />
        ) : item ? (
          <Icon key={item.id} id={item.id} />
        ) : (
          <Gem size={22} aria-hidden="true" />
        )}
        {category}
      </span>
    )
  }
  const autoQuotes = autoDisplayQuotes(rows, data?.pairs ?? [])
  const displayQuote = (id: string): Quote =>
    f.quote === "Auto" ? (autoQuotes.get(id) ?? "Exalted") : f.quote
  const quoteIndex = (id: string) => QUOTES.indexOf(displayQuote(id))
  const rate = (id: string) =>
    displayQuote(id) === "Exalted"
      ? 1
      : rows.find((r) => r.id === ANCHORS[displayQuote(id)])?.price
  const value = (r: ItemRow) => {
    const conversion = rate(r.id)
    return conversion ? r.price / conversion : null
  }
  const visible = rows
    .filter((r) => {
      const item = itemInfo(r.id)
      return (
        (f.category === "All currencies" || item.category === f.category) &&
        item.name.toLowerCase().includes(f.q.toLowerCase()) &&
        (!f.favorites || favorites.includes(r.id))
      )
    })
    .sort((a, b) => {
      let diff = 0
      if (f.sort === "name")
        diff = itemInfo(a.id).name.localeCompare(itemInfo(b.id).name)
      else if (f.sort === "change") {
        const av = a.changes[quoteIndex(a.id)],
          bv = b.changes[quoteIndex(b.id)]
        if (av === null) return 1
        if (bv === null) return -1
        diff = av - bv
      } else
        diff =
          f.sort === "volume"
            ? a.volume * a.price - b.volume * b.price
            : a.price - b.price
      return (f.dir === "asc" ? diff : -diff) || a.id.localeCompare(b.id)
    })
  const pages = Math.max(1, Math.ceil(visible.length / 25)),
    page = Math.min(f.page, pages),
    displayed = visible.slice((page - 1) * 25, page * 25)
  const metrics = new Map(
    (moverQuery.data?.hour === data?.hour &&
    moverQuery.data?.period === f.period
      ? moverQuery.data.rows
      : []
    ).map((row) => [row.id, row])
  )
  const moverChange = (r: ItemRow) =>
    metrics.get(r.id)?.changes[quoteIndex(r.id)] ?? null
  const movers = rows.filter(
    (r) =>
      metrics.get(r.id)?.eligible[quoteIndex(r.id)] && moverChange(r) !== null
  )
  const rising = [...movers]
    .filter((r) => moverChange(r)! > 0)
    .sort(
      (a, b) => moverChange(b)! - moverChange(a)! || a.id.localeCompare(b.id)
    )
    .slice(0, 50)
  const falling = [...movers]
    .filter((r) => moverChange(r)! < 0)
    .sort(
      (a, b) => moverChange(a)! - moverChange(b)! || a.id.localeCompare(b.id)
    )
    .slice(0, 50)
  const stale = !!data && isEconomyStale(data.hour, now)
  const sort = (key: Filters["sort"]) =>
    patch({
      sort: key,
      dir: f.sort === key && f.dir === "desc" ? "asc" : "desc",
    })
  const openItem = (id: string) => patch({ item: id })
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="wordmark" to="/economy" search={{ ...f, item: "" }}>
          <img src="/favicon.svg" alt="" width="30" height="30" />
          exile<span>.sh</span>
        </Link>
        <SiteNavigation
          filters={f}
          onLeagueChange={(league) => patch({ league, item: "" })}
          notice={
            stale
              ? `Updates are delayed. Latest available data: ${utc(data.hour)}.`
              : undefined
          }
        />
      </header>
      <main id="main">
        <section className={`market-heading ${f.item ? "compact" : ""}`}>
          <div className="hero-orb" aria-hidden="true">
            <img
              src="/art/divine-dither.png"
              alt=""
              width="176"
              height="176"
              decoding="async"
              fetchPriority="high"
            />
          </div>
          <div className="market-heading-copy">
            <h1>{moversPage ? "Market movers" : "Exchange economy"}</h1>
            <p className="market-meta">
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
            </p>
          </div>
        </section>
        {storageError && (
          <div className="notice">
            Your browser could not save favorites. They will last only for this
            session.
          </div>
        )}
        <div className="economy-pages">
          <div className="workspace-header">
            <nav
              className="view-tabs economy-page-nav"
              aria-label="Economy views"
            >
              <Link
                to="/economy/market"
                search={{ ...f, item: "" }}
                aria-current={!moversPage ? "page" : undefined}
              >
                <Gem size={15} /> Currency market
              </Link>
              <Link
                to="/economy/movers"
                search={{ ...f, item: "" }}
                aria-current={moversPage ? "page" : undefined}
              >
                <ArrowUpRight size={15} /> Market movers
              </Link>
            </nav>
            <div className="quote-picker">
              Display in
              <Select
                value={f.quote}
                onValueChange={(quote) => {
                  if (quote) patch({ quote })
                }}
                items={DISPLAY_CURRENCIES.map((quote) => ({
                  label: quote,
                  value: quote,
                }))}
              >
                <SelectTrigger aria-label="Quote currency" size="sm">
                  <SelectValue>
                    <DisplayCurrencyLabel quote={f.quote} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-max">
                  {DISPLAY_CURRENCIES.map((quote) => (
                    <SelectItem key={quote} value={quote}>
                      <DisplayCurrencyLabel quote={quote} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            {query.isError ? (
              <div className="empty-state">
                <CircleHelp />
                <h2>The market is temporarily unavailable.</h2>
                <p>
                  Your filters and favorites are safe. Try loading the data
                  again.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void query.refetch()
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : query.isPending ? (
              <div className="loading-market" role="status">
                <span className="status-dot" /> Reading the market…
                <Skeleton className="skeleton" />
                <Skeleton className="skeleton" />
                <Skeleton className="skeleton" />
              </div>
            ) : !data ? (
              <div className="empty-state">
                <Gem />
                <h2>No exchange data yet.</h2>
                <p>
                  No completed exchange hours have been imported for this league
                  yet.
                </p>
                <span>
                  Choose another league or return after collection begins.
                </span>
              </div>
            ) : f.item ? (
              <ItemDetail
                id={f.item}
                league={f.league}
                quote={displayQuote(f.item)}
                row={rows.find((r) => r.id === f.item)}
                price={
                  rate(f.item)
                    ? (rows.find((r) => r.id === f.item)?.price ?? 0) /
                      rate(f.item)!
                    : null
                }
                hour={data.hour}
                pairs={data.pairs}
                onBack={() => patch({ item: "" })}
                onItem={openItem}
                favorite={favorites.includes(f.item)}
                onFavorite={() => toggleFavorite(f.item)}
              />
            ) : moversPage ? (
              <section className="movers-section">
                <div className="section-title movers-controls">
                  <Select
                    value={f.period}
                    onValueChange={(period) => {
                      if (period) patch({ period })
                    }}
                    items={MOVER_PERIODS.map((period) => ({
                      value: period,
                      label: MOVER_PERIOD[period].label,
                    }))}
                  >
                    <SelectTrigger size="sm" aria-label="Movers period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-max">
                      {MOVER_PERIODS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {MOVER_PERIOD[period].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="period-label">
                    Activity-filtered{" "}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="help-trigger"
                            aria-label="How market movers are ranked"
                          />
                        }
                      >
                        <CircleHelp size={13} />
                      </TooltipTrigger>
                      <TooltipContent>
                        Three-hour weighted windows separated by the selected
                        period, at least 12 active hours in the latest day, and
                        at least 1,000 Exalted traded in each comparison window.
                        Sparklines show the last 48 hours.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </div>
                {moverQuery.isError ? (
                  <div className="empty-state">
                    <h2>Could not load this period.</h2>
                    <Button
                      onClick={() => {
                        void moverQuery.refetch()
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : moverQuery.isPending ||
                  moverQuery.data?.hour !== data.hour ? (
                  <div className="loading-market" role="status">
                    Loading rankings…
                  </div>
                ) : (
                  <div className="movers-grid">
                    {[
                      { title: "Decliners", data: falling, up: false },
                      { title: "Gainers", data: rising, up: true },
                    ].map((group) => (
                      <div
                        className={`mover-card ${group.up ? "gainers" : "losers"}`}
                        key={group.title}
                      >
                        <div className="mover-card-title">
                          <span>
                            {group.up ? (
                              <ArrowUpRight size={17} />
                            ) : (
                              <ArrowDownLeft size={17} />
                            )}
                            {group.title}
                          </span>
                          <span>
                            {group.data.length} · {f.period}
                          </span>
                        </div>
                        {group.data.length ? (
                          group.data.map((r, index) => (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mover-row"
                              key={r.id}
                              onClick={() => openItem(r.id)}
                            >
                              <span className="mover-rank" aria-hidden="true">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <Icon id={r.id} />
                              <span className="mover-name">
                                {itemInfo(r.id).name}
                                <small>
                                  {value(r) === null ? "—" : number(value(r)!)}{" "}
                                  {displayQuote(r.id).toLowerCase()}
                                </small>
                              </span>
                              <Sparkline values={r.trends[quoteIndex(r.id)]} />
                              <Delta value={moverChange(r)} />
                            </Button>
                          ))
                        ) : (
                          <div className="mover-empty">
                            No qualifying {group.up ? "gainers" : "decliners"}{" "}
                            yet.
                            <small>
                              {moverQuery.data?.hasComparison
                                ? "No active markets meet the liquidity threshold for this period."
                                : "Not enough recorded history for this period yet."}
                            </small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div className="economy-workbench">
                <section className="market-layout">
                  <div className="category-picker">
                    <label id="category-label">Category</label>
                    <Select
                      value={f.favorites ? "Watchlist" : f.category}
                      onValueChange={(category) => {
                        if (category)
                          patch({
                            favorites: category === "Watchlist",
                            category:
                              category === "Watchlist"
                                ? "All currencies"
                                : category,
                          })
                      }}
                      items={["Watchlist", ...CATEGORIES].map((category) => ({
                        label: category,
                        value: category,
                      }))}
                    >
                      <SelectTrigger aria-labelledby="category-label">
                        <SelectValue>
                          {categoryLabel(
                            f.favorites ? "Watchlist" : f.category
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-max">
                        <SelectItem value="Watchlist">
                          {categoryLabel("Watchlist")}
                        </SelectItem>
                        {categoryOptions.map(({ category }) => (
                          <SelectItem key={category} value={category}>
                            {categoryLabel(category)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <aside className="categories">
                    <nav aria-label="Currency categories">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={f.favorites ? "active" : ""}
                        aria-pressed={f.favorites}
                        onClick={() =>
                          patch({ favorites: true, category: "All currencies" })
                        }
                      >
                        <span>
                          <span className="item-icon">
                            <Star size={18} />
                          </span>
                          Watchlist
                        </span>
                        <small>
                          {
                            rows.filter((row) => favorites.includes(row.id))
                              .length
                          }
                        </small>
                      </Button>
                      {categoryOptions.map(
                        ({ category: cat, count, mostTraded }) => {
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              key={cat}
                              className={
                                !f.favorites && f.category === cat
                                  ? "active"
                                  : ""
                              }
                              aria-pressed={!f.favorites && f.category === cat}
                              onClick={() =>
                                patch({ category: cat, favorites: false })
                              }
                            >
                              <span>
                                {mostTraded && (
                                  <Icon
                                    key={mostTraded.id}
                                    id={mostTraded.id}
                                  />
                                )}
                                {cat}
                              </span>
                              <small>{count}</small>
                            </Button>
                          )
                        }
                      )}
                    </nav>
                    <div className="sidebar-note">
                      <span className="status-dot" />
                      <strong>Source: GGG Currency Exchange</strong>
                      <p>
                        Completed trades from GGG's official Currency Exchange.
                        Updated hourly when collection is running.
                      </p>
                      <Link to="/methodology" search={f}>
                        How prices work <ArrowRight size={12} />
                      </Link>
                    </div>
                  </aside>
                  <div className="market-table-panel">
                    <div className="table-toolbar">
                      <InputGroup className="search-input">
                        <InputGroupAddon>
                          <Search size={16} />
                        </InputGroupAddon>
                        <InputGroupInput
                          value={f.q}
                          onChange={(e) => patch({ q: e.target.value })}
                          placeholder="Find a currency…"
                          aria-label="Search currencies"
                          autoFocus
                        />
                        {f.q && (
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Clear search"
                              onClick={() => patch({ q: "" })}
                            >
                              <X size={13} />
                            </InputGroupButton>
                          </InputGroupAddon>
                        )}
                      </InputGroup>
                    </div>
                    <div className="table-scroll">
                      <Table
                        className="currency-table"
                        scrollLabel="Currency market, scroll horizontally for more columns"
                      >
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="star-column"
                              aria-label="Watchlist"
                            />
                            <TableHead
                              aria-sort={
                                f.sort === "name"
                                  ? f.dir === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sort("name")}
                              >
                                Currency
                              </Button>
                            </TableHead>
                            <TableHead
                              aria-sort={
                                f.sort === "price"
                                  ? f.dir === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sort("price")}
                              >
                                Price{" "}
                                {f.sort === "price" && <ArrowDown size={11} />}
                              </Button>
                            </TableHead>
                            <TableHead
                              className="hide-medium"
                              aria-sort={
                                f.sort === "volume"
                                  ? f.dir === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sort("volume")}
                                title="Sort by traded value in Exalted"
                              >
                                Volume <SlidersHorizontal size={11} />
                              </Button>
                            </TableHead>
                            <TableHead
                              aria-sort={
                                f.sort === "change"
                                  ? f.dir === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sort("change")}
                              >
                                24h change
                              </Button>
                            </TableHead>
                            <TableHead className="hide-small">
                              7d change
                            </TableHead>
                            <TableHead className="hide-small">
                              Last 48 hours
                            </TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayed.map((r) => (
                            <TableRow
                              key={r.id}
                              className="currency-row"
                              onClick={(event) => {
                                if (
                                  (event.target as HTMLElement).closest(
                                    "button, a, input"
                                  )
                                )
                                  return
                                openItem(r.id)
                              }}
                            >
                              <TableCell className="star-column">
                                <Toggle
                                  size="sm"
                                  className={`star-button ${favorites.includes(r.id) ? "saved" : ""}`}
                                  aria-label={`${favorites.includes(r.id) ? "Remove" : "Add"} ${itemInfo(r.id).name} ${favorites.includes(r.id) ? "from" : "to"} watchlist`}
                                  pressed={favorites.includes(r.id)}
                                  onPressedChange={() => toggleFavorite(r.id)}
                                >
                                  <Star
                                    size={14}
                                    fill={
                                      favorites.includes(r.id)
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </Toggle>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="currency-name"
                                  onClick={() => openItem(r.id)}
                                >
                                  <Icon id={r.id} glow />
                                  <span>{itemInfo(r.id).name}</span>
                                </Button>
                              </TableCell>
                              <TableCell className="price-cell">
                                {value(r) === null ? "—" : number(value(r)!)}
                                <img
                                  src={
                                    itemInfo(ANCHORS[displayQuote(r.id)]).icon
                                  }
                                  width="17"
                                  height="17"
                                  alt={displayQuote(r.id)}
                                />
                              </TableCell>
                              <TableCell
                                className="hide-medium volume-cell"
                                title={`${number(r.volume, 0)} item units in the pricing market`}
                              >
                                {compact(r.volume)}
                              </TableCell>
                              <TableCell>
                                <Delta value={r.changes[quoteIndex(r.id)]} />
                              </TableCell>
                              <TableCell className="hide-small">
                                <Delta value={r.changes7[quoteIndex(r.id)]} />
                              </TableCell>
                              <TableCell className="hide-small">
                                <Sparkline
                                  alignStart
                                  values={r.trends[quoteIndex(r.id)]}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="row-open"
                                  onClick={() => openItem(r.id)}
                                  aria-label={`View ${itemInfo(r.id).name} history`}
                                >
                                  <ChevronRight size={15} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {visible.length === 0 && (
                      <div className="empty-state compact-empty">
                        <Search size={24} />
                        <h3>No currencies found.</h3>
                        <p>Try a different search or category.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            patch({
                              q: "",
                              category: "All currencies",
                              favorites: false,
                            })
                          }
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
                    <div className="pagination">
                      <span>
                        {visible.length
                          ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, visible.length)} of ${visible.length}`
                          : "0 results"}
                      </span>
                      <span>
                        Page {page} of {pages}
                      </span>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => patch({ page: page - 1 })}
                          aria-label="Previous page"
                        >
                          <ChevronLeft size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={page >= pages}
                          onClick={() => patch({ page: page + 1 })}
                          aria-label="Next page"
                        >
                          <ChevronRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
        <section className="bottom-note">
          <CircleHelp size={15} />
          <p>
            Prices reflect completed exchange trades, not live offers. Thin
            markets can be volatile.{" "}
            <Link to="/methodology" search={f}>
              Read the methodology.
            </Link>
          </p>
        </section>
      </main>
      <footer>
        <Link
          className="footer-brand"
          to="/economy"
          search={{ ...f, item: "" }}
        >
          exile.sh
        </Link>
        <div className="footer-info">
          <p>Not affiliated with or endorsed by Grinding Gear Games.</p>
          <span className="source-time">
            {data
              ? `Last completed hour · ${utc(data.hour)}`
              : "Waiting for a completed exchange hour"}
          </span>
        </div>
        <div>
          <Link to="/methodology" search={f}>
            Data & attribution
          </Link>
          <a href="https://github.com/natedunn/exile.sh">
            GitHub <ExternalLink size={11} />
          </a>
        </div>
      </footer>
    </div>
  )
}

function ItemDetail({
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
}) {
  const [days, setDays] = useState<1 | 7 | 30 | 90>(7)
  const crpc = useCRPC(),
    query = useQuery(
      crpc.economy.itemHistory.queryOptions({ league, item: id, quote, days })
    )
  const info = itemInfo(id),
    qi = QUOTES.indexOf(quote)
  const points = query.data?.points ?? []
  return (
    <section className="detail-view">
      <Button
        variant="ghost"
        size="sm"
        className="back-button"
        onClick={onBack}
      >
        <ChevronLeft size={14} /> Back to market
      </Button>
      <div className="detail-header">
        <Icon id={id} large />
        <div>
          <h2>{info.name}</h2>
          <p>{info.description}</p>
        </div>
        <Toggle
          size="sm"
          className={`favorites-filter ${favorite ? "active" : ""}`}
          pressed={favorite}
          onPressedChange={onFavorite}
        >
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Watching" : "Watch currency"}
        </Toggle>
      </div>
      <div className="detail-stats">
        <div>
          <span className="metric-label">Executed average</span>
          <strong>
            {row && price !== null ? number(price) : "—"} <small>{quote}</small>
          </strong>
        </div>
        <div>
          <span className="metric-label">24-hour change</span>
          <strong>
            <Delta value={row?.changes[qi] ?? null} />
          </strong>
        </div>
        <div>
          <span className="metric-label">Hourly traded units</span>
          <strong>{row ? compact(row.volume) : "—"}</strong>
        </div>
        <div>
          <span className="metric-label">Observation</span>
          <span>{utc(hour)}</span>
          <small>
            {row?.direct
              ? "Direct Exalted market"
              : "Derived through an anchor currency"}
          </small>
        </div>
      </div>
      <div className="chart-panel">
        <div className="chart-toolbar">
          <h3>Price history</h3>
          <div className="range-tabs">
            {([1, 7, 30, 90] as const).map((d) => (
              <Button
                variant="ghost"
                size="sm"
                key={d}
                className={days === d ? "active" : ""}
                onClick={() => setDays(d)}
              >
                {d === 1 ? "24H" : `${d}D`}
              </Button>
            ))}
          </div>
        </div>
        {query.isError ? (
          <div className="chart-empty">
            <p>History could not be loaded.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void query.refetch()
              }}
            >
              Retry
            </Button>
          </div>
        ) : query.isPending ? (
          <div className="chart-empty" role="status">
            Loading history…
          </div>
        ) : (
          <Suspense
            fallback={<div className="chart-empty">Loading chart…</div>}
          >
            <MarketChart points={points} quote={quote} daily={days > 7} />
          </Suspense>
        )}
        <div className="history-caption">
          {points.length
            ? `${points.length} ${days > 7 ? "daily" : "hourly"} observations · Available from ${utc(points[0][0])}`
            : "History appears as completed hours are collected."}{" "}
          · Gaps are not interpolated.
        </div>
      </div>
      <Collapsible className="history-data">
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          View chart data
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="table-scroll">
            <Table scrollLabel="Price history data, scroll horizontally for more columns">
              <TableHeader>
                <TableRow>
                  <TableHead>Time (UTC)</TableHead>
                  <TableHead>Price ({quote})</TableHead>
                  <TableHead>Traded units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p) => (
                  <TableRow key={p[0]}>
                    <TableCell>{utc(p[0])}</TableCell>
                    <TableCell>{number(p[1])}</TableCell>
                    <TableCell>{number(p[2], 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <div className="detail-links">
        <a
          href={`https://www.poe2wiki.net/wiki/${encodeURIComponent(info.name.replaceAll(" ", "_"))}`}
          target="_blank"
          rel="noreferrer"
        >
          Read on PoE2 Wiki <ExternalLink size={12} />
        </a>
        <a
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
    <section className="pairs-panel">
      <div className="section-title">
        <h2>Exchange pairs</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={inverted}
          onClick={() => setInverted(!inverted)}
        >
          <ArrowLeftRight size={14} /> Invert pairs
        </Button>
      </div>
      <div className="table-toolbar">
        <InputGroup className="search-input">
          <InputGroupAddon>
            <Search size={15} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search exchange pairs"
            placeholder="Search either currency…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </InputGroup>
      </div>
      <div className="table-scroll">
        <Table
          className="pairs-table"
          scrollLabel="Exchange pairs, scroll horizontally for more columns"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Currency pair</TableHead>
              <TableHead>Average rate</TableHead>
              <TableHead>Traded units</TableHead>
              <TableHead>Hourly high stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.slice((current - 1) * 20, current * 20).map((p) => {
              const a = inverted ? p.b : p.a,
                b = inverted ? p.a : p.b,
                va = inverted ? p.vb : p.va,
                vb = inverted ? p.va : p.vb
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="pair-currencies">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onItem(a)}
                      >
                        <Icon id={a} />
                        {itemInfo(a).name}
                      </Button>
                      <ArrowRight size={12} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onItem(b)}
                      >
                        <Icon id={b} />
                        {itemInfo(b).name}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {va > 0 && vb > 0 ? `${number(vb / va)} : 1` : "No trades"}
                  </TableCell>
                  <TableCell>
                    {compact(va)} / {compact(vb)}
                  </TableCell>
                  <TableCell>
                    {compact(inverted ? p.sb : p.sa)} /{" "}
                    {compact(inverted ? p.sa : p.sb)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {!visible.length && <div className="chart-empty">No matching pairs.</div>}
      <div className="pagination">
        <span>
          Historical stock, not live offers. Rates are units of the second
          currency per one of the first.
        </span>
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            aria-label="Previous pairs"
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={current * 20 >= visible.length}
            onClick={() => setPage(current + 1)}
            aria-label="Next pairs"
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    </section>
  )
}
