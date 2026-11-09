import { lazy, Suspense, useState } from "react"
import { cn } from "cn"
import type { GemScaling } from "../../shared/gem-scaling"
import { formatScalingPoint } from "../lib/gem-display"
import { GemSection, GemSectionTitle } from "./gem-section"
import { SegmentedControl, SegmentedControlItem } from "./ui/segmented-control"
import { Skeleton } from "./ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

const GemScalingCharts = lazy(() => import("./gem-scaling-charts"))

/** Units the table states once in its header; cells keep only a "%". */
function cellUnit(unit: string) {
  return unit.startsWith("%") ? "%" : ""
}
function headerUnit(unit: string) {
  return unit.trim().replace(/^%$/, "")
}

// The site's ledger tables: mono caps headers, hairline rows, quiet
// figures, the shell gutter on the outer columns.
const head = "h-auto py-2.5 align-bottom mono-label font-normal text-ink-muted"
const firstCell = "pl-[var(--shell-gutter)]"
const lastCell = "pr-[var(--shell-gutter)]"

/** How each value that changes with gem level grows, as small multiples
 * with a table view of the same numbers. */
export function GemScalingSection({
  scaling,
  selectedLevel,
  onSelectLevel,
}: {
  scaling: GemScaling
  selectedLevel: number | null
  onSelectLevel: (level: number) => void
}) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const levels = Array.from(
    { length: scaling.maxLevel },
    (_, index) => index + 1
  )
  const charts = scaling.charts
  const columns = charts.flatMap((chart) =>
    chart.series.map((series) => ({ chart, series }))
  )
  if (charts.length === 0) return null
  return (
    <GemSection aria-labelledby="gem-scaling-title" data-slot="gem-scaling">
      <GemSectionTitle id="gem-scaling-title">Level scaling</GemSectionTitle>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-[var(--shell-gutter)]">
        <p className="m-0 text-sm text-ink-muted">
          Every value that changes with gem level, from 1 to {scaling.maxLevel}.
          Hover a chart to read a level across all of them; click to select it.
        </p>
        <SegmentedControl aria-label="Scaling view">
          {(["chart", "table"] as const).map((value) => (
            <SegmentedControlItem
              key={value}
              className="h-8"
              active={view === value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {value === "chart" ? "Chart" : "Table"}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      {view === "chart" ? (
        <div className="mt-4 px-[var(--shell-gutter)]">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {charts.map((chart) => (
                  <Skeleton key={chart.id} className="h-56" />
                ))}
              </div>
            }
          >
            <GemScalingCharts
              charts={charts}
              maxLevel={scaling.maxLevel}
              selectedLevel={selectedLevel}
              onSelectLevel={onSelectLevel}
            />
          </Suspense>
        </div>
      ) : (
        <div className="mt-4">
          <Table
            data-slot="gem-scaling-table"
            scrollLabel="Level scaling table"
            className="text-xs"
          >
            <TableHeader>
              <TableRow className="border-rule-strong hover:bg-transparent">
                <TableHead className={cn(head, firstCell)}>Level</TableHead>
                {columns.map(({ chart, series }, index) => (
                  <TableHead
                    key={series.key}
                    className={cn(
                      head,
                      "text-right",
                      index === columns.length - 1 && lastCell
                    )}
                  >
                    <span className="block">{chart.title}</span>
                    {(chart.series.length > 1 || headerUnit(chart.unit)) && (
                      <span className="block text-ink-faint normal-case">
                        {[
                          chart.series.length > 1 ? series.label : "",
                          headerUnit(chart.unit),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level) => {
                const selected = level === selectedLevel
                return (
                  <TableRow
                    key={level}
                    data-selected={selected ? "" : undefined}
                    aria-current={selected ? "true" : undefined}
                    className="border-rule hover:bg-hover/40 data-selected:bg-notice data-selected:hover:bg-notice"
                  >
                    <TableCell
                      className={cn(
                        firstCell,
                        "py-2 font-mono text-ink-muted tabular-nums",
                        selected &&
                          "font-medium text-brand shadow-[inset_2px_0_0_var(--color-brand)]"
                      )}
                    >
                      {level}
                    </TableCell>
                    {columns.map(({ chart, series }, index) => (
                      <TableCell
                        key={series.key}
                        className={cn(
                          "py-2 text-right font-mono tabular-nums",
                          selected ? "text-ink" : "text-ink-soft",
                          index === columns.length - 1 && lastCell
                        )}
                      >
                        {formatScalingPoint(
                          series.points[level - 1] ?? null,
                          cellUnit(chart.unit)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {scaling.unchanged.length > 0 && (
        <p className="mt-4 mb-0 px-[var(--shell-gutter)] text-sm text-ink-muted">
          The same at every level:{" "}
          {scaling.unchanged.map(({ label, value }, index) => (
            <span key={label}>
              {index > 0 && " · "}
              {label} <span className="text-ink">{value}</span>
            </span>
          ))}
        </p>
      )}
    </GemSection>
  )
}
