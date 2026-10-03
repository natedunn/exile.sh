import type { ComponentProps } from "react"
import { cn } from "cn"

/* The patch notes frame, shared by the index and the post page, is the
   gem and item pages' frame: content on the left, a 420px column of
   figures on the right with a rule between, both running frame to frame.
   Sections inside take the gem pages' title voice (GemSection). Under lg
   the column drops below the content. */

const gutter = "px-[var(--shell-gutter)]"

export function NewsPage({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col", className)} {...props} />
  )
}

export function NewsStatus({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="status"
      className={cn("py-8 text-sm text-ink-muted", className)}
      {...props}
    />
  )
}

export function PatchColumns({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-[var(--shell-gutter)] grid min-w-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]",
        className
      )}
      {...props}
    />
  )
}

export function PatchMain({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0 lg:border-r lg:border-rule-strong", className)}
      {...props}
    />
  )
}

export function PatchAside({ className, ...props }: ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "min-w-0 max-lg:border-t max-lg:border-rule-strong",
        className
      )}
      {...props}
    />
  )
}

/* A section title with something trailing its hairline: a count, a link,
   an action. */
export function PatchSectionHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-6 items-center gap-4 [&>h2]:min-w-0 [&>h2]:flex-1 [&>h2]:px-0",
        gutter,
        className
      )}
      {...props}
    />
  )
}

/* Mono caption beside a row: a date, a count, a link-out marker. */
export const feedCaption = "mono-label text-ink-muted"

/* A row that lights up on hover; the whole row is the link. */
export const feedRow =
  "border-b border-rule text-ink transition-[background-color,color] duration-120 hover:bg-hover"

export { gutter }
