import { cn } from "cn"
import { ArrowDownLeft, ArrowUpRight, CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, EmptyStateTitle } from "@/components/ui/empty-state"
import { LabelText } from "@/components/ui/label"
import { Panel } from "@/components/ui/panel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ItemRow, Quote } from "../../../shared/economy"
import { MOVER_PERIOD, MOVER_PERIODS } from "../../../shared/movers"
import { itemInfo } from "../../lib/catalog"
import type { Filters } from "../../lib/economy-filters"
import { number } from "../../lib/format"
import { Delta, Icon, Sparkline } from "./icon"
import { EmptyAction } from "./shared"

export function MoversSection({
  f,
  patch,
  status,
  hasComparison,
  rising,
  falling,
  change,
  value,
  displayQuote,
  quoteIndex,
  openItem,
  retry,
}: {
  f: Filters
  patch: (values: Partial<Filters>) => void
  status: "error" | "loading" | "ready"
  hasComparison: boolean
  rising: ItemRow[]
  falling: ItemRow[]
  change: (r: ItemRow) => number | null
  value: (r: ItemRow) => number | null
  displayQuote: (id: string) => Quote
  quoteIndex: (id: string) => number
  openItem: (id: string) => void
  retry: () => void
}) {
  return (
    <section data-testid="movers-section" className="mt-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
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
        <LabelText>
          Activity-filtered{" "}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5.5 text-ink-muted"
                  aria-label="How market movers are ranked"
                />
              }
            >
              <CircleHelp size={13} />
            </TooltipTrigger>
            <TooltipContent>
              Three-hour weighted windows separated by the selected period, at
              least 12 active hours in the latest day, and at least 1,000
              Exalted traded in each comparison window. Sparklines show the last
              48 hours.
            </TooltipContent>
          </Tooltip>
        </LabelText>
      </div>
      {status === "error" ? (
        <EmptyState>
          <EmptyStateTitle>Could not load this period.</EmptyStateTitle>
          <EmptyAction onClick={retry}>Retry</EmptyAction>
        </EmptyState>
      ) : status === "loading" ? (
        <div className="py-12 font-mono text-xs text-ink-muted" role="status">
          Loading rankings…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-8 max-lg:gap-6 max-sm:grid-cols-1">
          {[
            { title: "Decliners", data: falling, up: false },
            { title: "Gainers", data: rising, up: true },
          ].map((group) => (
            <Panel
              key={group.title}
              data-testid={group.up ? "gainers" : "losers"}
              rule="top"
              surface="none"
              fade="tint"
              className={
                group.up
                  ? "[--dither-color:var(--color-positive)]"
                  : "[--dither-color:var(--color-negative)]"
              }
            >
              <div className="flex items-baseline justify-between gap-3 border-b border-rule px-3 pt-4 pb-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 display text-section max-sm:text-2xl [&_svg]:size-5",
                    group.up ? "text-positive" : "text-negative"
                  )}
                >
                  {group.up ? (
                    <ArrowUpRight size={17} />
                  ) : (
                    <ArrowDownLeft size={17} />
                  )}
                  {group.title}
                </span>
                <LabelText>
                  {group.data.length} · {f.period}
                </LabelText>
              </div>
              {group.data.length ? (
                group.data.map((r, index) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="mover-row"
                    className={cn(
                      "relative flex h-auto min-h-17 w-full items-center justify-start gap-3 rounded-none border-b border-rule bg-transparent px-3 py-2 text-left text-sm hover:bg-surface max-lg:py-3 max-sm:px-2",
                      group.up
                        ? "hover:shadow-[inset_3px_0_0_var(--color-positive)]"
                        : "hover:shadow-[inset_3px_0_0_var(--color-negative)]"
                    )}
                    key={r.id}
                    onClick={() => openItem(r.id)}
                  >
                    <span
                      className="w-[2ch] font-mono text-label tracking-normal text-ink-faint"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon id={r.id} size="mover" />
                    <span className="min-w-0 flex-1 truncate text-ink max-lg:whitespace-normal">
                      {itemInfo(r.id).name}
                      <small className="mt-0.5 block figure text-label text-ink-muted">
                        {value(r) === null ? "—" : number(value(r)!)}{" "}
                        {displayQuote(r.id).toLowerCase()}
                      </small>
                    </span>
                    <Sparkline
                      values={r.trends[quoteIndex(r.id)]}
                      width={80}
                      className="ml-auto max-xl:hidden"
                    />
                    <Delta
                      value={change(r)}
                      className="min-w-19 justify-end text-sm max-sm:min-w-0"
                    />
                  </Button>
                ))
              ) : (
                <div className="min-h-30 px-3 py-6 text-sm text-ink-muted">
                  No qualifying {group.up ? "gainers" : "decliners"} yet.
                  <small className="mt-2 block text-xs leading-relaxed text-ink-faint">
                    {hasComparison
                      ? "No active markets meet the liquidity threshold for this period."
                      : "Not enough recorded history for this period yet."}
                  </small>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </section>
  )
}
