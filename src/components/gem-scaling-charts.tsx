import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ScalingChart } from "../../shared/gem-scaling"
import { compact } from "../lib/format"
import { formatScalingPoint } from "../lib/gem-display"

/* Small multiples, one per scaling value: values in different units never
 * share an axis. Every chart shares the level axis and a synced crosshair,
 * so hovering one level reads it across all of them. */

// Fixed order, never cycled; gemScaling caps a chart at three series.
const COLORS = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
]
// Dashes keep each series identifiable without colour.
const DASHES = [undefined, "6 4", "2 3"]

const axisTick = {
  fill: "var(--color-ink-muted)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
}

function Swatch({ index }: { index: number }) {
  return (
    <svg aria-hidden="true" width="20" height="8" className="shrink-0">
      <line
        x1="1"
        x2="19"
        y1="4"
        y2="4"
        stroke={COLORS[index]}
        strokeWidth="2"
        strokeDasharray={DASHES[index]}
        strokeLinecap="round"
      />
    </svg>
  )
}

function ScalingTooltip({
  active,
  label,
  chart,
}: {
  active?: boolean
  label?: number | string
  chart: ScalingChart
}) {
  if (!active || label === undefined) return null
  const level = Number(label)
  return (
    <div className="popup-corners min-w-36 border border-rule-strong bg-surface px-3 py-2 font-mono text-xs text-ink">
      <p className="mb-1 text-ink-muted">Level {level}</p>
      {chart.series.map((series, index) => (
        <p key={series.key} className="flex items-center gap-2">
          {chart.series.length > 1 && <Swatch index={index} />}
          {chart.series.length > 1 && (
            <span className="text-ink-muted">{series.label}</span>
          )}
          <span className="ml-auto pl-2 tabular-nums">
            {formatScalingPoint(series.points[level - 1] ?? null, chart.unit)}
          </span>
        </p>
      ))}
    </div>
  )
}

function ScalingChartCard({
  chart,
  maxLevel,
  selectedLevel,
  onSelectLevel,
}: {
  chart: ScalingChart
  maxLevel: number
  selectedLevel: number | null
  onSelectLevel: (level: number) => void
}) {
  const data = Array.from({ length: maxLevel }, (_, index) => {
    const row: Record<string, number | [number, number] | null> = {
      level: index + 1,
    }
    for (const series of chart.series) {
      const point = series.points[index] ?? null
      row[series.key] = point?.value ?? null
      row[`${series.key}:range`] =
        point?.low !== undefined && point.high !== undefined
          ? [point.low, point.high]
          : null
    }
    return row
  })
  const ticks = maxLevel > 20 ? [1, 10, 20, 30, 40] : [1, 5, 10, 15, 20]
  const first = chart.series[0].points[0] ?? null
  const last = chart.series[0].points[maxLevel - 1] ?? null
  const selected =
    selectedLevel === null
      ? null
      : (chart.series[0].points[selectedLevel - 1] ?? null)
  const summary = chart.series
    .map((series) => {
      const start = formatScalingPoint(series.points[0] ?? null, chart.unit)
      const end = formatScalingPoint(
        series.points[maxLevel - 1] ?? null,
        chart.unit
      )
      return `${series.label}: ${start} at level 1, ${end} at level ${maxLevel}`
    })
    .join("; ")
  return (
    <figure
      data-slot="gem-scaling-chart"
      className="m-0 flex min-w-0 flex-col border border-rule bg-paper-deep px-3 pt-3 pb-1"
    >
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg leading-snug text-ink">
          {chart.title}
        </span>
        {/* One series: its value at the chosen level, or the full span. */}
        {chart.series.length === 1 && (
          <span className="shrink-0 font-mono text-xs text-ink-muted tabular-nums">
            {selected
              ? formatScalingPoint(selected, chart.unit)
              : `${formatScalingPoint(first, "")} → ${formatScalingPoint(last, chart.unit)}`}
          </span>
        )}
      </figcaption>
      {chart.series.length > 1 && (
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 font-mono text-xs text-ink-muted">
          {chart.series.map((series, index) => (
            <li key={series.key} className="flex items-center gap-1.5">
              <Swatch index={index} />
              {series.label}
              {selectedLevel !== null && (
                <span className="text-ink tabular-nums">
                  {formatScalingPoint(
                    series.points[selectedLevel - 1] ?? null,
                    chart.unit
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Plots sit at the card's foot, so level axes line up across a row. */}
      <div
        role="img"
        aria-label={`${chart.title} by gem level. ${summary}.`}
        className="mt-auto pt-2"
      >
        <ResponsiveContainer width="100%" height={168}>
          <ComposedChart
            data={data}
            syncId="gem-scaling"
            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
            className="cursor-pointer"
            onClick={(state) => {
              const level = Number(state.activeLabel)
              if (Number.isInteger(level) && level > 0) onSelectLevel(level)
            }}
          >
            <defs>
              {chart.series.map((series, index) => (
                <pattern
                  key={series.key}
                  id={`scaling-band-${chart.id}-${index}`.replace(
                    /[^\w-]/g,
                    "_"
                  )}
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="1.5" height="1.5" fill={COLORS[index]} />
                  <rect
                    x="2"
                    y="2"
                    width="1.5"
                    height="1.5"
                    fill={COLORS[index]}
                  />
                </pattern>
              ))}
            </defs>
            <CartesianGrid
              stroke="var(--color-rule)"
              strokeDasharray="1 3"
              vertical={false}
            />
            <XAxis
              dataKey="level"
              type="number"
              domain={[1, maxLevel]}
              ticks={ticks}
              axisLine={false}
              tickLine={false}
              tick={axisTick}
            />
            <YAxis
              domain={[0, "auto"]}
              tickFormatter={(value: number) => compact(value)}
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-rule-strong)" }}
              content={({ active, label }) => (
                <ScalingTooltip active={active} label={label} chart={chart} />
              )}
              isAnimationActive={false}
            />
            {selectedLevel !== null && (
              <ReferenceLine
                x={selectedLevel}
                stroke="var(--color-brand-deep)"
                strokeDasharray="2 3"
              />
            )}
            {chart.series.map((series, index) =>
              series.points.some((point) => point?.low !== undefined) ? (
                <Area
                  key={`${series.key}:range`}
                  dataKey={`${series.key}:range`}
                  type="linear"
                  stroke="none"
                  fill={`url(#${`scaling-band-${chart.id}-${index}`.replace(/[^\w-]/g, "_")})`}
                  fillOpacity={0.5}
                  isAnimationActive={false}
                  tooltipType="none"
                  legendType="none"
                  activeDot={false}
                />
              ) : null
            )}
            {chart.series.map((series, index) => (
              <Line
                key={series.key}
                dataKey={series.key}
                name={series.label}
                type="linear"
                stroke={COLORS[index]}
                strokeWidth={2}
                strokeDasharray={DASHES[index]}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: COLORS[index],
                  stroke: "var(--color-paper-deep)",
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export default function GemScalingCharts({
  charts,
  maxLevel,
  selectedLevel,
  onSelectLevel,
}: {
  charts: ScalingChart[]
  maxLevel: number
  selectedLevel: number | null
  onSelectLevel: (level: number) => void
}) {
  return (
    <div
      data-slot="gem-scaling-charts"
      className="grid grid-cols-2 gap-3 max-md:grid-cols-1"
    >
      {charts.map((chart) => (
        <ScalingChartCard
          key={chart.id}
          chart={chart}
          maxLevel={maxLevel}
          selectedLevel={selectedLevel}
          onSelectLevel={onSelectLevel}
        />
      ))}
    </div>
  )
}
