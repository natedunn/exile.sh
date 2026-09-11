import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { HOUR } from "../../shared/economy"
import type { Point } from "../../shared/economy"
import { compact, number, utc } from "../lib/format"

export default function MarketChart({
  points,
  quote,
  daily = false,
}: {
  points: Point[]
  quote: string
  daily?: boolean
}) {
  const byHour = new Map(points.map((p) => [p[0], p]))
  const first = points.at(0)?.[0],
    last = points.at(-1)?.[0]
  const data =
    first !== undefined && last !== undefined
      ? Array.from(
          {
            length: Math.floor((last - first) / (daily ? HOUR * 24 : HOUR)) + 1,
          },
          (_, i) => {
            const t = first + i * (daily ? HOUR * 24 : HOUR),
              p = byHour.get(t)
            return { time: t, price: p?.[1] ?? null, volume: p?.[2] ?? null }
          }
        )
      : []
  if (data.length === 0)
    return <div className="chart-empty">No completed trades in this range.</div>
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${daily ? "Daily" : "Hourly"} price in ${quote}, with traded volume. ${points.length} observations. Missing hours are gaps.`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 6, left: 6, bottom: 12 }}
        >
          <defs>
            {/* Ordered-dither fills: volume bars are a dot screen, the price
                area is a sparser screen that reads as a soft halftone. */}
            <pattern
              id="volume-dither"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
            >
              <rect width="2" height="2" fill="var(--color-brand-deep)" />
              <rect
                x="2"
                y="2"
                width="2"
                height="2"
                fill="var(--color-brand-deep)"
              />
            </pattern>
            <pattern
              id="price-dither"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <rect width="1.5" height="1.5" fill="var(--color-brand)" />
              <rect
                x="3"
                y="3"
                width="1.5"
                height="1.5"
                fill="var(--color-brand)"
              />
            </pattern>
          </defs>
          <CartesianGrid
            stroke="var(--color-rule)"
            strokeDasharray="1 3"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={(v: number) =>
              new Date(v * 1000).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })
            }
            minTickGap={55}
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "var(--color-text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => number(v)}
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "var(--color-text-muted)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            width={65}
          />
          <YAxis yAxisId="volume" hide domain={[0, (max: number) => max * 5]} />
          <Tooltip
            labelFormatter={(v) => utc(Number(v))}
            formatter={(value, name) => [
              name === "Price"
                ? `${number(Number(value))} ${quote}`
                : compact(Number(value)),
              name,
            ]}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-rule-strong)",
              borderRadius: 2,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink)",
            }}
          />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            name="Traded units"
            fill="url(#volume-dither)"
            fillOpacity={0.55}
            isAnimationActive={false}
          />
          <Area
            yAxisId="price"
            dataKey="price"
            name="Price"
            type="linear"
            stroke="none"
            fill="url(#price-dither)"
            fillOpacity={0.35}
            connectNulls={false}
            isAnimationActive={false}
            tooltipType="none"
            legendType="none"
          />
          <Line
            yAxisId="price"
            dataKey="price"
            name="Price"
            type="linear"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={points.length < 4 ? { r: 3 } : false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span>
          <i /> Executed average · {quote}
        </span>
        <span>
          <i className="volume-dot" /> Traded units
        </span>
      </div>
    </div>
  )
}
