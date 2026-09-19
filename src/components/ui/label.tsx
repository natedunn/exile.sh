import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* The mono label voice: field captions, metric names, column heads. */
const labelVariants = cva("inline-flex items-center gap-2 mono-label", {
  variants: {
    tone: {
      muted: "text-ink-muted",
      faint: "text-ink-faint",
      ink: "text-ink",
      brand: "text-brand",
    },
    tracking: {
      default: "",
      tight: "tracking-label-tight",
    },
  },
  defaultVariants: { tone: "muted", tracking: "default" },
})

function Label({
  className,
  tone,
  tracking,
  ...props
}: React.ComponentProps<"label"> & VariantProps<typeof labelVariants>) {
  return (
    <label
      data-slot="label"
      className={cn(labelVariants({ tone, tracking }), className)}
      {...props}
    />
  )
}

/* Same voice on a span, for text that is not a form label. */
function LabelText({
  className,
  tone,
  tracking,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof labelVariants>) {
  return (
    <span
      data-slot="label-text"
      className={cn(labelVariants({ tone, tracking }), className)}
      {...props}
    />
  )
}

export { Label, LabelText, labelVariants }
