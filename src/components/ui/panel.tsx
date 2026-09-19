import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* A bordered surface. Tint the wash with [--dither-color:…]. */
const panelVariants = cva("relative min-w-0", {
  variants: {
    rule: {
      default: "border border-rule",
      strong: "border border-rule-strong",
      top: "border-t border-rule-strong",
      dashed: "border border-dashed border-rule-strong",
      none: "",
    },
    surface: {
      surface: "bg-surface",
      paper: "bg-paper",
      deep: "bg-paper-deep",
      none: "",
    },
    fade: {
      none: "",
      brand: "dither-fade",
      tint: "dither-fade [--dither-opacity:0.08]",
    },
  },
  defaultVariants: { rule: "strong", surface: "surface", fade: "none" },
})

function Panel({
  className,
  rule,
  surface,
  fade,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof panelVariants>) {
  return (
    <div
      data-slot="panel"
      className={cn(panelVariants({ rule, surface, fade }), className)}
      {...props}
    />
  )
}

export { Panel, panelVariants }
