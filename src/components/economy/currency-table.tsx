import { cn } from "cn"
import {
  ArrowDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  EmptyState,
  EmptyStateText,
  EmptyStateTitle,
} from "@/components/ui/empty-state"
import { InputGroupAddon, InputGroupButton } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ANCHORS } from "../../../shared/economy"
import type { ItemRow, Quote } from "../../../shared/economy"
import { itemInfo } from "../../lib/catalog"
import type { Filters } from "../../lib/economy-filters"
import { compact, number } from "../../lib/format"
import { Delta, Icon, Sparkline } from "./icon"
import {
  EmptyAction,
  PageButtons,
  Pagination,
  SearchField,
  SearchHotkey,
  TableFrame,
  TableToolbar,
} from "./shared"

/* Column heads and cells set their own inset: the table's global th/td
   rules are on their way out. */
export const headCell =
  "h-auto border-y border-rule bg-surface/60 p-3 text-left whitespace-nowrap mono-label text-ink-muted"
export const bodyCell = "p-3 text-sm"

function SortButton({
  sorted,
  dir,
  onClick,
  children,
}: {
  sorted: boolean
  dir: Filters["dir"]
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-auto gap-2 p-0 mono-label hover:bg-transparent hover:text-ink",
        sorted ? "text-brand" : "text-ink-muted",
        sorted && dir === "asc" && "[&_svg]:rotate-180"
      )}
    >
      {children}
    </Button>
  )
}

export function CurrencyTable({
  f,
  patch,
  search,
  displayed,
  total,
  page,
  pages,
  favorites,
  toggleFavorite,
  displayQuote,
  quoteIndex,
  value,
  openItem,
}: {
  f: Filters
  patch: (values: Partial<Filters>) => void
  search: React.RefObject<HTMLInputElement | null>
  displayed: ItemRow[]
  total: number
  page: number
  pages: number
  favorites: string[]
  toggleFavorite: (id: string) => void
  displayQuote: (id: string) => Quote
  quoteIndex: (id: string) => number
  value: (r: ItemRow) => number | null
  openItem: (id: string) => void
}) {
  const ariaSort = (key: Filters["sort"]) =>
    f.sort === key ? (f.dir === "asc" ? "ascending" : "descending") : "none"
  const sort = (key: Filters["sort"]) =>
    patch({
      sort: key,
      dir: f.sort === key && f.dir === "desc" ? "asc" : "desc",
    })
  const star = "w-12 px-2 lg:pl-6"
  return (
    <div className="flex w-full min-w-0 flex-col self-stretch">
      {/* Beside the sidebar the panel has no padding of its own: the search
          sits in a padded strip closed by a rule, and the table below runs
          from the divider to the frame with only its cells keeping an inset. */}
      <TableToolbar className="lg:border-b lg:border-rule-strong lg:p-6">
        <SearchField
          ref={search}
          value={f.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Find a currency…"
          aria-label="Search currencies"
        >
          {!f.q && <SearchHotkey />}
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
        </SearchField>
      </TableToolbar>
      <TableFrame hint="currency">
        <Table
          data-testid="currency-table"
          className="min-w-255 table-auto border-collapse text-left"
          scrollLabel="Currency market, scroll horizontally for more columns"
        >
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              {/* The toolbar's rule already closes the top of the table. */}
              <TableHead
                className={cn(headCell, star, "lg:border-t-0")}
                aria-label="Watchlist"
              />
              <TableHead
                className={cn(headCell, "lg:border-t-0")}
                aria-sort={ariaSort("name")}
              >
                <SortButton
                  sorted={f.sort === "name"}
                  dir={f.dir}
                  onClick={() => sort("name")}
                >
                  Currency
                </SortButton>
              </TableHead>
              <TableHead
                className={cn(headCell, "lg:border-t-0")}
                aria-sort={ariaSort("price")}
              >
                <SortButton
                  sorted={f.sort === "price"}
                  dir={f.dir}
                  onClick={() => sort("price")}
                >
                  Price {f.sort === "price" && <ArrowDown size={11} />}
                </SortButton>
              </TableHead>
              <TableHead
                className={cn(headCell, "lg:border-t-0")}
                aria-sort={ariaSort("volume")}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-auto gap-2 p-0 mono-label hover:bg-transparent hover:text-ink",
                          f.sort === "volume" ? "text-brand" : "text-ink-muted",
                          f.sort === "volume" &&
                            f.dir === "asc" &&
                            "[&_svg]:rotate-180"
                        )}
                      />
                    }
                    onClick={() => sort("volume")}
                  >
                    Volume <SlidersHorizontal size={11} />
                  </TooltipTrigger>
                  <TooltipContent>
                    Sort by traded value in Exalted
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead
                className={cn(headCell, "lg:border-t-0")}
                aria-sort={ariaSort("change")}
              >
                <SortButton
                  sorted={f.sort === "change"}
                  dir={f.dir}
                  onClick={() => sort("change")}
                >
                  24h change
                </SortButton>
              </TableHead>
              <TableHead className={cn(headCell, "lg:border-t-0")}>
                7d change
              </TableHead>
              <TableHead className={cn(headCell, "lg:border-t-0")}>
                Last 48 hours
              </TableHead>
              <TableHead className={cn(headCell, "lg:border-t-0")} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r) => {
              const saved = favorites.includes(r.id)
              const name = itemInfo(r.id).name
              return (
                <TableRow
                  key={r.id}
                  data-testid="currency-row"
                  className="group/row cursor-pointer border-rule transition-none focus-within:bg-surface focus-within:shadow-[inset_3px_0_0_var(--color-brand-deep)] hover:bg-surface hover:shadow-[inset_3px_0_0_var(--color-brand-deep)]"
                  onClick={(event) => {
                    if (
                      (event.target as HTMLElement).closest("button, a, input")
                    )
                      return
                    openItem(r.id)
                  }}
                >
                  <TableCell className={cn(bodyCell, star, "h-15.5")}>
                    <Toggle
                      size="sm"
                      className="size-7 min-w-0 rounded bg-transparent p-0 text-ink-faint hover:bg-transparent hover:text-ink aria-pressed:bg-transparent aria-pressed:text-brand data-[state=on]:bg-transparent"
                      aria-label={`${saved ? "Remove" : "Add"} ${name} ${saved ? "from" : "to"} watchlist`}
                      pressed={saved}
                      onPressedChange={() => toggleFavorite(r.id)}
                    >
                      <Star size={14} fill={saved ? "currentColor" : "none"} />
                    </Toggle>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "h-15.5")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex h-auto max-w-75 min-w-60 justify-start gap-4 bg-transparent p-0 text-left text-sm font-[450] text-ink hover:bg-transparent hover:text-ink max-xl:max-w-55 max-xl:min-w-50"
                      onClick={() => openItem(r.id)}
                    >
                      <Icon id={r.id} glow />
                      <span className="truncate group-focus-within/row:underline group-focus-within/row:decoration-dotted group-focus-within/row:underline-offset-4 group-hover/row:underline group-hover/row:decoration-dotted group-hover/row:underline-offset-4">
                        {name}
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell
                    data-testid="price-cell"
                    className={cn(
                      bodyCell,
                      "h-15.5 figure text-base font-medium whitespace-nowrap text-ink"
                    )}
                  >
                    {value(r) === null ? "—" : number(value(r)!)}
                    <img
                      src={itemInfo(ANCHORS[displayQuote(r.id)]).icon}
                      width="17"
                      height="17"
                      alt={displayQuote(r.id)}
                      className="ml-1.5 inline-block size-5 object-contain align-[-4px]"
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyCell,
                      "h-15.5 figure text-xs text-ink-muted"
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger render={<span />} tabIndex={0}>
                        {compact(r.volume)}
                      </TooltipTrigger>
                      <TooltipContent>
                        {number(r.volume, 0)} item units in the pricing market
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "h-15.5")}>
                    <Delta value={r.changes[quoteIndex(r.id)]} />
                  </TableCell>
                  <TableCell className={cn(bodyCell, "h-15.5")}>
                    <Delta value={r.changes7[quoteIndex(r.id)]} />
                  </TableCell>
                  <TableCell className={cn(bodyCell, "h-15.5")}>
                    <Sparkline alignStart values={r.trends[quoteIndex(r.id)]} />
                  </TableCell>
                  <TableCell className={cn(bodyCell, "h-15.5")}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-5 bg-transparent p-0 text-ink-faint group-hover/row:text-brand hover:bg-transparent"
                      onClick={() => openItem(r.id)}
                      aria-label={`View ${name} history`}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableFrame>
      {total === 0 && (
        <EmptyState size="compact">
          <Search size={24} />
          <EmptyStateTitle>No currencies found.</EmptyStateTitle>
          <EmptyStateText>Try a different search or category.</EmptyStateText>
          <EmptyAction
            onClick={() =>
              patch({ q: "", category: "All currencies", favorites: false })
            }
          >
            Clear filters
          </EmptyAction>
        </EmptyState>
      )}
      <Pagination className="lg:px-6">
        <span>
          {total
            ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total}`
            : "0 results"}
        </span>
        <span>
          Page {page} of {pages}
        </span>
        <PageButtons
          previous={page > 1}
          next={page < pages}
          onPrevious={() => patch({ page: page - 1 })}
          onNext={() => patch({ page: page + 1 })}
          labels={["Previous page", "Next page"]}
        />
      </Pagination>
    </div>
  )
}
