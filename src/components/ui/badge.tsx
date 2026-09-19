import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* A small mono tag. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono leading-snug tracking-[0.03em] break-words uppercase",
  {
    variants: {
      variant: {
        brand: "border-brand/30 bg-brand/8 text-brand-muted",
        outline: "border-rule-strong bg-transparent text-ink-muted",
        notice: "border-brand-deep bg-notice text-brand",
        negative: "border-negative/30 bg-negative/10 text-negative",
      },
      size: {
        xs: "text-micro",
        sm: "px-2 py-0.75 text-label",
      },
    },
    defaultVariants: { variant: "brand", size: "xs" },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/* The rotated bronze square that marks live status. */
function StatusDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="status-dot"
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 rotate-45 bg-brand",
        className
      )}
      {...props}
    />
  )
}

export { Badge, StatusDot, badgeVariants }
