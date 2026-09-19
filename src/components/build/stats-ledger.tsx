import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* The figures column is a ledger: a mono label over rows of muted names
 * and tabular figures, each closed by a hairline. Under lg the ledger's
 * groups sit two abreast; on phones they stack again. */

const statsBodyVariants = cva("grid gap-6", {
  variants: {
    layout: {
      aside:
        "grid-cols-[minmax(0,1fr)] max-lg:grid-cols-2 max-lg:gap-x-8 max-sm:grid-cols-[minmax(0,1fr)] max-sm:gap-6",
      /** The expanded dialog: one column, names allowed to wrap. */
      expanded: "grid-cols-[minmax(0,1fr)]",
    },
  },
  defaultVariants: { layout: "aside" },
})

function StatsBody({
  className,
  layout,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statsBodyVariants>) {
  return (
    <div
      data-slot="stats-body"
      data-layout={layout ?? "aside"}
      className={cn(statsBodyVariants({ layout }), className)}
      {...props}
    />
  )
}

function StatsSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return <section className={cn("min-w-0", className)} {...props} />
}

const statsHeadingVariants = cva("", {
  variants: {
    layout: {
      aside: "mb-1 border-b border-rule-strong pb-2 mono-label text-ink-muted",
      expanded: "mb-3 text-sm font-medium text-ink",
    },
  },
  defaultVariants: { layout: "aside" },
})

function StatsHeading({
  className,
  layout,
  ...props
}: React.ComponentProps<"h3"> & VariantProps<typeof statsHeadingVariants>) {
  return (
    <h3
      className={cn(statsHeadingVariants({ layout }), className)}
      {...props}
    />
  )
}

function StatsList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("m-0", className)} {...props} />
}

const statsRowClass =
  "flex items-baseline justify-between gap-4 border-b border-rule py-[7px] text-xs"

/** One name/figure pair. Names stay on one line in the aside and wrap in
 * the expanded dialog, where the figure keeps its width instead. */
function StatsRow({
  label,
  children,
  wrap = false,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  children: React.ReactNode
  wrap?: boolean
}) {
  return (
    <div className={cn(statsRowClass, className)} {...props}>
      <dt
        className={cn(
          "text-ink-muted",
          wrap ? "[overflow-wrap:anywhere]" : "whitespace-nowrap"
        )}
      >
        {label}
      </dt>
      <dd className={cn("m-0 text-right figure text-ink", wrap && "shrink-0")}>
        {children}
      </dd>
    </div>
  )
}

/** The line under a ledger heading naming the skill or count it sums. */
function StatsCaption({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("pt-2 pb-1 text-sm font-medium text-ink", className)}
      {...props}
    />
  )
}

export {
  StatsBody,
  StatsSection,
  StatsHeading,
  StatsList,
  StatsRow,
  StatsCaption,
  statsRowClass,
}
