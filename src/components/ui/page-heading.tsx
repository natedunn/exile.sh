import * as React from "react"
import { cn } from "cn"

/* The masthead: a serif title, its meta line, and room for art on the right. */
function PageHeading({
  className,
  compact = false,
  ...props
}: React.ComponentProps<"header"> & {
  /** Step back so the content below leads. */
  compact?: boolean
}) {
  return (
    <header
      data-slot="page-heading"
      data-compact={compact ? "" : undefined}
      className={cn(
        "relative flex items-end justify-between gap-6 overflow-hidden border-b border-rule-strong pt-8 pb-4 max-sm:min-h-0",
        compact ? "min-h-0 pt-6 pb-3" : "min-h-50",
        className
      )}
      {...props}
    />
  )
}

function PageHeadingCopy({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-heading-copy"
      className={cn("relative z-1 grid min-w-0 gap-3", className)}
      {...props}
    />
  )
}

function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-title"
      className={cn(
        "display text-title text-ink in-data-compact:text-3xl in-data-compact:text-ink-muted max-sm:text-4xl [&>span]:text-brand",
        className
      )}
      {...props}
    />
  )
}

/* Mono facts under the title, separated by bronze diamonds. */
function PageMeta({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-meta"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 mono-label text-ink-muted in-data-compact:hidden [&_strong]:font-medium [&_strong]:text-brand-ink [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2 [&>span+span]:before:size-1 [&>span+span]:before:rotate-45 [&>span+span]:before:bg-brand [&>span+span]:before:content-['']",
        className
      )}
      {...props}
    />
  )
}

export { PageHeading, PageHeadingCopy, PageTitle, PageMeta }
