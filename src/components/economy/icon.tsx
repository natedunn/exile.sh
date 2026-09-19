import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { ArrowDownLeft, ArrowUpRight, Gem, Shuffle } from "lucide-react"
import { useState } from "react"
import { ANCHORS } from "../../../shared/economy"
import { itemInfo } from "../../lib/catalog"
import type { Filters } from "../../lib/economy-filters"
import { percent } from "../../lib/format"

/* A currency's art in a fixed frame, bronze glyph when there is none. */
export const iconFrame = cva(
  "relative isolate inline-flex shrink-0 items-center justify-center text-brand [&>img]:block [&>img]:object-contain [&>img]:drop-shadow-[0_3px_3px] [&>img]:drop-shadow-scrim/50 [&>img]:transition-transform [&>img]:duration-120 [&>img]:ease-out",
  {
    variants: {
      size: {
        default: "size-8 [&>img]:size-8",
        xs: "size-4.5 [&>img]:size-4.5",
        sm: "size-5.5 [&>img]:size-5.5",
        category: "size-6.5 [&>img]:size-6.5",
        pair: "size-7 [&>img]:size-7",
        mover: "size-8.5 [&>img]:size-8.5",
        /* The detail masthead: a dot-screen halo behind a larger image. */
        large:
          "size-18 before:absolute before:-inset-[45%] before:-z-1 before:dot-screen before:mask-[radial-gradient(circle_closest-side,black_25%,transparent_100%)] before:text-brand before:opacity-55 before:content-[''] [&>img]:size-15",
      },
    },
    defaultVariants: { size: "default" },
  }
)

export function Icon({
  id,
  size,
  glow = false,
  className,
}: {
  id: string
  glow?: boolean
  className?: string
} & VariantProps<typeof iconFrame>) {
  const [broken, setBroken] = useState(false)
  const item = itemInfo(id)
  const large = size === "large"
  return (
    <span
      data-testid="item-icon"
      className={cn(iconFrame({ size }), className)}
    >
      {glow && item.icon && !broken && (
        <img
          className="pointer-events-none absolute inset-0 -z-1 m-auto scale-125 opacity-0 blur-[7px] transition-opacity duration-120 ease-out group-focus-within/row:opacity-70 group-hover/row:opacity-70"
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
          className={cn(
            glow && "group-focus-within/row:scale-105 group-hover/row:scale-105"
          )}
        />
      ) : (
        <Gem size={large ? 30 : 19} />
      )}
    </span>
  )
}

export function DisplayCurrencyLabel({ quote }: { quote: Filters["quote"] }) {
  return (
    <span className="inline-flex items-center gap-2">
      {quote === "Auto" ? (
        <Shuffle size={18} aria-hidden="true" />
      ) : (
        <Icon id={ANCHORS[quote]} size="xs" />
      )}
      {quote}
    </span>
  )
}

export function Delta({
  value,
  className,
}: {
  value: number | null
  className?: string
}) {
  const trend =
    value === null || value === 0
      ? "neutral"
      : value > 0
        ? "positive"
        : "negative"
  return (
    <span
      data-testid="delta"
      data-trend={trend}
      className={cn(
        "inline-flex items-center gap-0.5 figure text-xs whitespace-nowrap data-[trend=negative]:text-negative data-[trend=neutral]:text-ink-faint data-[trend=positive]:text-positive",
        className
      )}
    >
      {value !== null &&
        value !== 0 &&
        (value > 0 ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />)}
      {percent(value)}
    </span>
  )
}

/* Width and height ride on the SVG attributes: `size-auto` keeps a parent
   Button's svg sizing rule off it while the attributes give it its box. */
export function Sparkline({
  values,
  alignStart = false,
  width = 96,
  className,
}: {
  values: (number | null)[]
  alignStart?: boolean
  width?: number
  className?: string
}) {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2)
    return (
      <span className="font-mono text-label tracking-label-tight text-ink-faint uppercase">
        Collecting history
      </span>
    )
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
      width={width}
      height={30}
      className={cn(
        "block size-auto shrink-0 [&_path]:stroke-2 [&_path]:[shape-rendering:crispEdges]",
        up ? "text-positive" : "text-negative",
        className
      )}
      viewBox={`${alignStart ? (values.findIndex((value) => value !== null) * 100) / (values.length - 1) : 0} 0 100 32`}
      preserveAspectRatio="xMinYMid meet"
      aria-label={`${up ? "Rising" : "Falling"} over available 48-hour history`}
      role="img"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
