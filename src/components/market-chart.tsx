import {
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
          <CartesianGrid stroke="#ffffff09" vertical={false} />
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
            tick={{ fill: "#7e867e", fontSize: 11 }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => number(v)}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#999f95", fontSize: 11 }}
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
              background: "#1a1e1a",
              border: "1px solid #645639",
              borderRadius: 4,
              fontSize: 12,
              color: "#ddd9cb",
            }}
          />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            name="Traded units"
            fill="#9caa8b22"
            isAnimationActive={false}
          />
          <Line
            yAxisId="price"
            dataKey="price"
            name="Price"
            type="linear"
            stroke="#c6a56a"
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
