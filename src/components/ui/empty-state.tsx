import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* Nothing to show: an optional icon, a title, a line of copy, an action. */
const emptyStateVariants = cva(
  "flex flex-col items-center gap-3 text-center text-ink-muted [&>svg]:text-brand",
  {
    variants: {
      size: {
        default: "px-5 py-16",
        compact: "flex-1 justify-center px-2.5 py-10",
        inline: "min-h-30 items-start px-3 py-6 text-left",
        chart: "min-h-45 justify-center font-mono text-xs",
      },
      frame: {
        none: "",
        dashed: "my-8 border border-dashed border-rule-strong px-4 py-12",
      },
    },
    defaultVariants: { size: "default", frame: "none" },
  }
)

function EmptyState({
  className,
  size,
  frame,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyStateVariants>) {
  return (
    <div
      data-slot="empty-state"
      className={cn(emptyStateVariants({ size, frame }), className)}
      {...props}
    />
  )
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="empty-state-title"
      className={cn("display text-section text-ink", className)}
      {...props}
    />
  )
}

function EmptyStateText({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-text"
      className={cn("max-w-[44ch] text-sm leading-relaxed", className)}
      {...props}
    />
  )
}

export { EmptyState, EmptyStateTitle, EmptyStateText, emptyStateVariants }
