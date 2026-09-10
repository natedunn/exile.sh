import { Button } from "../components/ui/button"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
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
import type { ReactNode } from "react"
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  GitBranch,
  Search,
  Star,
  X,
  SlidersHorizontal,
  ArrowLeftRight,
  Gem,
} from "lucide-react"
import { z } from "zod"
import { useCRPC } from "../lib/convex/crpc"
import { CATEGORIES, itemInfo } from "../lib/catalog"
import { compact, number, percent, utc } from "../lib/format"
import { ANCHORS, DEFAULT_LEAGUE, LEAGUES, QUOTES } from "../../shared/economy"
import type { ItemRow, Pair, Quote } from "../../shared/economy"

const MarketChart = lazy(() => import("../components/market-chart"))
export const filters = z.object({
  league: z.enum(LEAGUES).catch(DEFAULT_LEAGUE),
  quote: z.enum(QUOTES).catch("Exalted"),
  category: z.string().catch("All currencies"),
  q: z.string().max(120).catch(""),
  sort: z.enum(["price", "name", "change", "volume"]).catch("volume"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
  favorites: z.boolean().catch(false),
  item: z.string().max(240).catch(""),
  tab: z.enum(["currencies", "exchange"]).catch("currencies"),
})
export type Filters = z.infer<typeof filters>

function Icon({ id, large = false }: { id: string; large?: boolean }) {
  const [broken, setBroken] = useState(false)
  const item = itemInfo(id)
  return (
    <span className={`item-icon ${large ? "large" : ""}`}>
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
function Sparkline({ values }: { values: (number | null)[] }) {
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
      viewBox="0 0 100 32"
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
    rows = data?.prices ?? [],
    qi = QUOTES.indexOf(f.quote)
  const rate =
    f.quote === "Exalted"
      ? 1
      : rows.find((r) => r.id === ANCHORS[f.quote])?.price
  const value = (r: ItemRow) => (rate ? r.price / rate : null)
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
        const av = a.changes[qi],
          bv = b.changes[qi]
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
  const movers = rows.filter((r) => r.eligible[qi] && r.changes[qi] !== null)
  const rising = [...movers]
    .filter((r) => r.changes[qi]! > 0)
    .sort((a, b) => b.changes[qi]! - a.changes[qi]!)
    .slice(0, 10)
  const falling = [...movers]
    .filter((r) => r.changes[qi]! < 0)
    .sort((a, b) => a.changes[qi]! - b.changes[qi]!)
    .slice(0, 10)
  const stale = !!data && now > (data.hour + 3 * 3600) * 1000
  const sort = (key: Filters["sort"]) =>
    patch({
      sort: key,
      dir: f.sort === key && f.dir === "desc" ? "asc" : "desc",
    })
  const openItem = (id: string) => patch({ item: id })
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/">
          <img src="/favicon.svg" alt="" width="30" height="30" />
          exile<span>.sh</span>
        </a>
        <nav aria-label="Main navigation">
          <Link
            to="/"
            search={{ ...f, item: "" }}
            className={!moversPage ? "nav-active" : ""}
            aria-current={!moversPage ? "page" : undefined}
          >
            Economy
          </Link>
          <Link
            to="/movers"
            search={{ ...f, item: "" }}
            className={moversPage ? "nav-active" : ""}
            aria-current={moversPage ? "page" : undefined}
          >
            Market movers
          </Link>
        </nav>
        <a
          className="source-link"
          href="https://github.com/natedunn/exile.sh"
          target="_blank"
          rel="noreferrer"
        >
          <GitBranch size={14} />
          <span>Open source</span>
          <ExternalLink size={12} />
        </a>
      </header>
      <main id="main">
        <section className="market-heading">
          <div>
            <h1>{moversPage ? "Market movers" : "Exchange economy"}</h1>
          </div>
          <div className="market-context">
            <Select
              value={f.league}
              onValueChange={(league) => {
                if (league) patch({ league, item: "" })
              }}
              items={LEAGUES.map((league) => ({
                label: league,
                value: league,
              }))}
            >
              <SelectTrigger className="league-picker" aria-label="League">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {LEAGUES.map((league) => (
                  <SelectItem key={league} value={league}>
                    {league}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="source-time">
              {data
                ? `Last completed hour · ${utc(data.hour)}`
                : "Waiting for a completed exchange hour"}
            </span>
          </div>
        </section>
        {stale && (
          <div className="notice">
            <CircleHelp size={15} /> Showing historical data from{" "}
            {utc(data.hour)}. New hours have not been collected yet.
          </div>
        )}
        {storageError && (
          <div className="notice">
            Your browser could not save favorites. They will last only for this
            session.
          </div>
        )}
        <EconomyViews
          moversPage={moversPage}
          value={f.tab}
          onValueChange={(tab) =>
            patch({ tab: tab as Filters["tab"], item: "" })
          }
          className="economy-tabs"
        >
          <div className="workspace-header">
            {!moversPage && (
              <TabsList
                className="view-tabs"
                variant="line"
                aria-label="Economy view"
              >
                <TabsTrigger value="currencies">
                  <Gem size={15} /> Currency market
                </TabsTrigger>
                <TabsTrigger value="exchange">
                  <ArrowLeftRight size={15} /> Exchange pairs
                </TabsTrigger>
              </TabsList>
            )}
            <div className="quote-picker">
              Display in
              <Select
                value={f.quote}
                onValueChange={(quote) => {
                  if (quote) patch({ quote })
                }}
                items={QUOTES.map((quote) => ({ label: quote, value: quote }))}
              >
                <SelectTrigger aria-label="Quote currency" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {QUOTES.map((quote) => (
                    <SelectItem key={quote} value={quote}>
                      {quote}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <EconomyContent moversPage={moversPage} value={f.tab}>
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
                quote={f.quote}
                row={rows.find((r) => r.id === f.item)}
                price={
                  rate
                    ? (rows.find((r) => r.id === f.item)?.price ?? 0) / rate
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
                <div className="section-title">
                  <span className="period-label">
                    24h · Activity-filtered{" "}
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
                        Three-hour weighted windows, at least 12 active hours,
                        and at least 1,000 Exalted traded in each comparison
                        window.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </div>
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
                        <span>24H</span>
                      </div>
                      {group.data.length ? (
                        group.data.map((r) => (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mover-row"
                            key={r.id}
                            onClick={() => openItem(r.id)}
                          >
                            <Icon id={r.id} />
                            <span className="mover-name">
                              {itemInfo(r.id).name}
                              <small>
                                {value(r) === null ? "—" : number(value(r)!)}{" "}
                                {f.quote.toLowerCase()}
                              </small>
                            </span>
                            <Sparkline values={r.trends[qi]} />
                            <Delta value={r.changes[qi]} />
                          </Button>
                        ))
                      ) : (
                        <div className="mover-empty">
                          No qualifying {group.up ? "gainers" : "decliners"}{" "}
                          yet.
                          <small>
                            Rankings appear once enough active hours are
                            recorded.
                          </small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : f.tab === "exchange" ? (
              <PairTable pairs={data.pairs} onItem={openItem} />
            ) : (
              <div className="economy-workbench">
                <section className="market-layout">
                  <aside className="categories">
                    <nav aria-label="Currency categories">
                      {CATEGORIES.map((cat) => {
                        const categoryRows = rows.filter(
                          (r) =>
                            cat === "All currencies" ||
                            itemInfo(r.id).category === cat
                        )
                        const count = categoryRows.length
                        const mostTraded = categoryRows.reduce<
                          ItemRow | undefined
                        >(
                          (best, row) =>
                            !best ||
                            row.volume * row.price > best.volume * best.price
                              ? row
                              : best,
                          undefined
                        )
                        if (count === 0 && cat !== "All currencies") return null
                        return (
                          <Button
                            variant="ghost"
                            size="sm"
                            key={cat}
                            className={f.category === cat ? "active" : ""}
                            aria-pressed={f.category === cat}
                            onClick={() => patch({ category: cat })}
                          >
                            <span>
                              {mostTraded && (
                                <Icon key={mostTraded.id} id={mostTraded.id} />
                              )}
                              {cat}
                            </span>
                            <small>{count}</small>
                          </Button>
                        )
                      })}
                    </nav>
                    <div className="sidebar-note">
                      <span className="status-dot" />
                      <strong>Source: GGG Currency Exchange</strong>
                      <p>
                        Completed trades from GGG's official Currency Exchange.
                        Updated hourly when collection is running.
                      </p>
                      <a href="/methodology">
                        How prices work <ArrowRight size={12} />
                      </a>
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
                      <Toggle
                        size="sm"
                        className={`favorites-filter ${f.favorites ? "active" : ""}`}
                        onPressedChange={(pressed) =>
                          patch({ favorites: pressed })
                        }
                        pressed={f.favorites}
                      >
                        <Star size={14} /> Watchlist{" "}
                        {favorites.length > 0 && (
                          <span>{favorites.length}</span>
                        )}
                      </Toggle>
                      <span className="table-count">
                        {visible.length} currencies
                      </span>
                    </div>
                    <div className="table-scroll">
                      <Table className="currency-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="star-column">
                              <Star size={11} aria-label="Favorite" />
                            </TableHead>
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
                            <TableHead className="hide-small">
                              Last 48 hours
                            </TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayed.map((r) => (
                            <TableRow key={r.id}>
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
                                  <Icon id={r.id} />
                                  <span>
                                    {itemInfo(r.id).name}
                                    {!r.direct && <small>Derived rate</small>}
                                  </span>
                                </Button>
                              </TableCell>
                              <TableCell className="price-cell">
                                {value(r) === null ? "—" : number(value(r)!)}
                                <img
                                  src={itemInfo(ANCHORS[f.quote]).icon}
                                  width="17"
                                  height="17"
                                  alt={f.quote}
                                />
                              </TableCell>
                              <TableCell>
                                <Delta value={r.changes[qi]} />
                              </TableCell>
                              <TableCell className="hide-small">
                                <Delta value={r.changes7[qi]} />
                              </TableCell>
                              <TableCell
                                className="hide-medium volume-cell"
                                title={`${number(r.volume, 0)} item units in the pricing market`}
                              >
                                {compact(r.volume)}
                              </TableCell>
                              <TableCell className="hide-small">
                                <Sparkline values={r.trends[qi]} />
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
          </EconomyContent>
        </EconomyViews>
        <section className="bottom-note">
          <CircleHelp size={15} />
          <p>
            Prices reflect completed exchange trades, not live offers. Thin
            markets can be volatile.{" "}
            <a href="/methodology">Read the methodology.</a>
          </p>
        </section>
      </main>
      <footer>
        <a className="footer-brand" href="/">
          exile.sh
        </a>
        <p>Not affiliated with or endorsed by Grinding Gear Games.</p>
        <div>
          <a href="/methodology">Data & attribution</a>
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
            <Table>
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
        <div>
          <h2>Exchange pairs</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="favorites-filter"
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
        <span className="table-count">{visible.length} pairs</span>
      </div>
      <div className="table-scroll">
        <Table className="pairs-table">
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
                    <Button variant="ghost" size="sm" onClick={() => onItem(a)}>
                      <Icon id={a} />
                      {itemInfo(a).name}
                    </Button>
                    <ArrowRight size={12} />
                    <Button variant="ghost" size="sm" onClick={() => onItem(b)}>
                      <Icon id={b} />
                      {itemInfo(b).name}
                    </Button>
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

function EconomyViews({
  moversPage,
  children,
  ...props
}: { moversPage: boolean; children: ReactNode } & React.ComponentProps<
  typeof Tabs
>) {
  return moversPage ? (
    <div className="movers-page">{children}</div>
  ) : (
    <Tabs {...props}>{children}</Tabs>
  )
}
function EconomyContent({
  moversPage,
  value,
  children,
}: {
  moversPage: boolean
  value: string
  children: ReactNode
}) {
  return moversPage ? (
    <div>{children}</div>
  ) : (
    <TabsContent value={value}>{children}</TabsContent>
  )
}
