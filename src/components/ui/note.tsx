import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* Muted supporting copy: footnotes, captions, margin notes. */
const noteVariants = cva("text-ink-muted", {
  variants: {
    size: {
      xs: "text-xs leading-relaxed",
      sm: "text-sm leading-relaxed",
    },
    rule: {
      none: "",
      top: "mt-8 flex items-center gap-3 border-t border-rule-strong py-4",
    },
  },
  defaultVariants: { size: "xs", rule: "none" },
})

function Note({
  className,
  size,
  rule,
  ...props
}: React.ComponentProps<"p"> & VariantProps<typeof noteVariants>) {
  return (
    <p
      data-slot="note"
      className={cn(noteVariants({ size, rule }), className)}
      {...props}
    />
  )
}

export { Note, noteVariants }
