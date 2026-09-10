import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useState } from "react"
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
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
  Layers3,
} from "lucide-react"
import { z } from "zod"
import { useCRPC } from "../lib/convex/crpc"
import { CATEGORIES, itemInfo } from "../lib/catalog"
import { compact, number, percent, utc } from "../lib/format"
import { ANCHORS, DEFAULT_LEAGUE, LEAGUES, QUOTES } from "../../shared/economy"
import type { ItemRow, Pair, Quote } from "../../shared/economy"

const MarketChart = lazy(() => import("../components/market-chart"))
const filters = z.object({
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
type Filters = z.infer<typeof filters>
export const Route = createFileRoute("/")({
  validateSearch: (search) => filters.parse(search),
  component: EconomyPage,
})

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

function EconomyPage() {
  const f = Route.useSearch(),
    navigate = Route.useNavigate(),
    crpc = useCRPC()
  const patch = (values: Partial<Filters>) => {
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...values }) })
  }
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
    .slice(0, 3)
  const falling = [...movers]
    .filter((r) => r.changes[qi]! < 0)
    .sort((a, b) => a.changes[qi]! - b.changes[qi]!)
    .slice(0, 3)
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
          <a className="nav-active" href="/">
            Economy
          </a>
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
            <p className="game-label">Path of Exile 2</p>
            <h1>Exchange economy</h1>
          </div>
          <div className="market-context">
            <label className="league-picker">
              <span className="status-dot" />
              <select
                aria-label="League"
                value={f.league}
                onChange={(e) =>
                  patch({
                    league: e.target.value as Filters["league"],
                    item: "",
                  })
                }
              >
                {LEAGUES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <span className="source-time">
              {data
                ? `Last completed hour · ${utc(data.hour)}`
                : "Waiting for a completed exchange hour"}
            </span>
          </div>
        </section>
        <section
          className="benchmark-strip"
          aria-label="Benchmark exchange rates"
        >
          {QUOTES.map((quote) => {
            const row = rows.find((r) => r.id === ANCHORS[quote])
            return (
              <div className="benchmark" key={quote}>
                <Icon id={ANCHORS[quote]} />
                <div>
                  <span className="overline">{quote} Orb</span>
                  <strong>
                    {row && rate ? number(row.price / rate) : "—"}{" "}
                    <small>{f.quote.toLowerCase()}</small>
                  </strong>
                </div>
                {row && <Delta value={row.changes[qi]} />}
              </div>
            )
          })}
          <div className="benchmark activity">
            <Layers3 size={23} />
            <div>
              <span className="overline">Active exchange pairs</span>
              <strong>
                {data
                  ? number(
                      data.pairs.filter((p) => p.va > 0 && p.vb > 0).length,
                      0
                    )
                  : "—"}
                <small> this hour</small>
              </strong>
            </div>
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
        <div className="workspace-header">
          <div className="view-tabs">
            <button
              className={f.tab === "currencies" ? "selected" : ""}
              onClick={() => patch({ tab: "currencies", item: "" })}
            >
              <Gem size={15} /> Currency market
            </button>
            <button
              className={f.tab === "exchange" ? "selected" : ""}
              onClick={() => patch({ tab: "exchange", item: "" })}
            >
              <ArrowLeftRight size={15} /> Exchange pairs
            </button>
          </div>
          <label className="quote-picker">
            Display in{" "}
            <select
              value={f.quote}
              onChange={(e) => patch({ quote: e.target.value as Quote })}
            >
              {QUOTES.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
        </div>
        {query.isError ? (
          <div className="empty-state">
            <CircleHelp />
            <h2>The market is temporarily unavailable.</h2>
            <p>
              Your filters and favorites are safe. Try loading the data again.
            </p>
            <button
              onClick={() => {
                void query.refetch()
              }}
            >
              Retry
            </button>
          </div>
        ) : query.isPending ? (
          <div className="loading-market" role="status">
            <span className="status-dot" /> Reading the market…
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
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
        ) : f.tab === "exchange" ? (
          <PairTable pairs={data.pairs} onItem={openItem} />
        ) : (
          <div className="economy-workbench">
            <section className="movers-section">
              <div className="section-title">
                <div>
                  <h2>Market movers</h2>
                </div>
                <span className="period-label">
                  24h · Activity-filtered{" "}
                  <CircleHelp size={13}>
                    <title>
                      Three-hour weighted windows, at least 12 active hours, and
                      a minimum traded value.
                    </title>
                  </CircleHelp>
                </span>
              </div>
              <div className="movers-grid">
                {[
                  { title: "Gainers", data: rising, up: true },
                  { title: "Decliners", data: falling, up: false },
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
                        <button
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
                        </button>
                      ))
                    ) : (
                      <div className="mover-empty">
                        No qualifying {group.up ? "gainers" : "decliners"} yet.
                        <small>
                          Rankings appear once enough active hours are recorded.
                        </small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <section className="market-layout">
              <aside className="categories">
                <span className="category-label">Categories</span>
                <nav aria-label="Currency categories">
                  {CATEGORIES.map((cat) => {
                    const count = rows.filter(
                      (r) =>
                        cat === "All currencies" ||
                        itemInfo(r.id).category === cat
                    ).length
                    if (count === 0 && cat !== "All currencies") return null
                    return (
                      <button
                        key={cat}
                        className={f.category === cat ? "active" : ""}
                        onClick={() => patch({ category: cat })}
                      >
                        <span>
                          {cat === "All currencies" ? (
                            <Layers3 size={14} />
                          ) : (
                            <span className="category-diamond" />
                          )}
                          {cat}
                        </span>
                        <small>{count}</small>
                      </button>
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
                  <label className="search-input">
                    <Search size={16} />
                    <input
                      value={f.q}
                      onChange={(e) => patch({ q: e.target.value })}
                      placeholder="Find a currency…"
                      aria-label="Search currencies"
                    />
                    {f.q && (
                      <button
                        aria-label="Clear search"
                        onClick={() => patch({ q: "" })}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <button
                    className={`favorites-filter ${f.favorites ? "active" : ""}`}
                    onClick={() => patch({ favorites: !f.favorites })}
                    aria-pressed={f.favorites}
                  >
                    <Star size={14} /> Watchlist{" "}
                    {favorites.length > 0 && <span>{favorites.length}</span>}
                  </button>
                  <span className="table-count">
                    {visible.length} currencies
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="currency-table">
                    <thead>
                      <tr>
                        <th className="star-column">
                          <Star size={11} aria-label="Favorite" />
                        </th>
                        <th
                          aria-sort={
                            f.sort === "name"
                              ? f.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button onClick={() => sort("name")}>Currency</button>
                        </th>
                        <th
                          aria-sort={
                            f.sort === "price"
                              ? f.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button onClick={() => sort("price")}>
                            Price{" "}
                            {f.sort === "price" && <ArrowDown size={11} />}
                          </button>
                        </th>
                        <th
                          aria-sort={
                            f.sort === "change"
                              ? f.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button onClick={() => sort("change")}>
                            24h change
                          </button>
                        </th>
                        <th className="hide-small">7d change</th>
                        <th
                          className="hide-medium"
                          aria-sort={
                            f.sort === "volume"
                              ? f.dir === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button
                            onClick={() => sort("volume")}
                            title="Sort by traded value in Exalted"
                          >
                            Volume <SlidersHorizontal size={11} />
                          </button>
                        </th>
                        <th className="hide-small">Last 48 hours</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((r) => (
                        <tr key={r.id}>
                          <td className="star-column">
                            <button
                              className={`star-button ${favorites.includes(r.id) ? "saved" : ""}`}
                              aria-label={`${favorites.includes(r.id) ? "Remove" : "Add"} ${itemInfo(r.id).name} ${favorites.includes(r.id) ? "from" : "to"} watchlist`}
                              aria-pressed={favorites.includes(r.id)}
                              onClick={() => toggleFavorite(r.id)}
                            >
                              <Star
                                size={14}
                                fill={
                                  favorites.includes(r.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </td>
                          <td>
                            <button
                              className="currency-name"
                              onClick={() => openItem(r.id)}
                            >
                              <Icon id={r.id} />
                              <span>
                                {itemInfo(r.id).name}
                                {!r.direct && <small>Derived rate</small>}
                              </span>
                            </button>
                          </td>
                          <td className="price-cell">
                            {value(r) === null ? "—" : number(value(r)!)}
                            <img
                              src={itemInfo(ANCHORS[f.quote]).icon}
                              width="17"
                              height="17"
                              alt={f.quote}
                            />
                          </td>
                          <td>
                            <Delta value={r.changes[qi]} />
                          </td>
                          <td className="hide-small">
                            <Delta value={r.changes7[qi]} />
                          </td>
                          <td
                            className="hide-medium volume-cell"
                            title={`${number(r.volume, 0)} item units in the pricing market`}
                          >
                            {compact(r.volume)}
                          </td>
                          <td className="hide-small">
                            <Sparkline values={r.trends[qi]} />
                          </td>
                          <td>
                            <button
                              className="row-open"
                              onClick={() => openItem(r.id)}
                              aria-label={`View ${itemInfo(r.id).name} history`}
                            >
                              <ChevronRight size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visible.length === 0 && (
                  <div className="empty-state compact-empty">
                    <Search size={24} />
                    <h3>No currencies found.</h3>
                    <p>Try a different search or category.</p>
                    <button
                      onClick={() =>
                        patch({
                          q: "",
                          category: "All currencies",
                          favorites: false,
                        })
                      }
                    >
                      Clear filters
                    </button>
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
                    <button
                      disabled={page <= 1}
                      onClick={() => patch({ page: page - 1 })}
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      disabled={page >= pages}
                      onClick={() => patch({ page: page + 1 })}
                      aria-label="Next page"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
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
      <button className="back-button" onClick={onBack}>
        <ChevronLeft size={14} /> Back to market
      </button>
      <div className="detail-header">
        <Icon id={id} large />
        <div>
          <span className="section-kicker">{info.category}</span>
          <h2>{info.name}</h2>
          <p>{info.description}</p>
        </div>
        <button
          className={`favorites-filter ${favorite ? "active" : ""}`}
          onClick={onFavorite}
        >
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Watching" : "Watch currency"}
        </button>
      </div>
      <div className="detail-stats">
        <div>
          <span className="overline">Executed average</span>
          <strong>
            {row && price !== null ? number(price) : "—"} <small>{quote}</small>
          </strong>
        </div>
        <div>
          <span className="overline">24-hour change</span>
          <strong>
            <Delta value={row?.changes[qi] ?? null} />
          </strong>
        </div>
        <div>
          <span className="overline">Hourly traded units</span>
          <strong>{row ? compact(row.volume) : "—"}</strong>
        </div>
        <div>
          <span className="overline">Observation</span>
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
              <button
                key={d}
                className={days === d ? "active" : ""}
                onClick={() => setDays(d)}
              >
                {d === 1 ? "24H" : `${d}D`}
              </button>
            ))}
          </div>
        </div>
        {query.isError ? (
          <div className="chart-empty">
            <p>History could not be loaded.</p>
            <button
              onClick={() => {
                void query.refetch()
              }}
            >
              Retry
            </button>
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
      <details className="history-data">
        <summary>View chart data</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Price ({quote})</th>
                <th>Traded units</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p[0]}>
                  <td>{utc(p[0])}</td>
                  <td>{number(p[1])}</td>
                  <td>{number(p[2], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
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
        <button
          className="favorites-filter"
          onClick={() => setInverted(!inverted)}
        >
          <ArrowLeftRight size={14} /> Invert pairs
        </button>
      </div>
      <div className="table-toolbar">
        <label className="search-input">
          <Search size={15} />
          <input
            aria-label="Search exchange pairs"
            placeholder="Search either currency…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <span className="table-count">{visible.length} pairs</span>
      </div>
      <div className="table-scroll">
        <table className="pairs-table">
          <thead>
            <tr>
              <th>Currency pair</th>
              <th>Average rate</th>
              <th>Traded units</th>
              <th>Hourly high stock</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice((current - 1) * 20, current * 20).map((p) => {
              const a = inverted ? p.b : p.a,
                b = inverted ? p.a : p.b,
                va = inverted ? p.vb : p.va,
                vb = inverted ? p.va : p.vb
              return (
                <tr key={p.id}>
                  <td>
                    <button onClick={() => onItem(a)}>
                      <Icon id={a} />
                      {itemInfo(a).name}
                    </button>
                    <ArrowRight size={12} />
                    <button onClick={() => onItem(b)}>
                      <Icon id={b} />
                      {itemInfo(b).name}
                    </button>
                  </td>
                  <td>
                    {va > 0 && vb > 0 ? `${number(vb / va)} : 1` : "No trades"}
                  </td>
                  <td>
                    {compact(va)} / {compact(vb)}
                  </td>
                  <td>
                    {compact(inverted ? p.sb : p.sa)} /{" "}
                    {compact(inverted ? p.sa : p.sb)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!visible.length && <div className="chart-empty">No matching pairs.</div>}
      <div className="pagination">
        <span>
          Historical stock, not live offers. Rates are units of the second
          currency per one of the first.
        </span>
        <div>
          <button
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            aria-label="Previous pairs"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            disabled={current * 20 >= visible.length}
            onClick={() => setPage(current + 1)}
            aria-label="Next pairs"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  )
}
