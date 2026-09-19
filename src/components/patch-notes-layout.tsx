import type { ComponentProps } from "react"
import { cn } from "cn"

/* The patch notes frame, shared by the index and the post page: two
   columns that run frame to frame like the exchange workbench, a divider
   between them that reaches down to meet the bottom note's rule, and a
   labelled strip opening each column. */

const gutter = "px-[var(--shell-gutter)]"

export function NewsPage({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("pb-16 max-sm:pb-8", className)} {...props} />
}

export function NewsStatus({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="status"
      className={cn("mt-9 text-ink-muted", className)}
      {...props}
    />
  )
}

export function PatchLayout({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative -mx-[var(--shell-gutter)] grid min-w-0 grid-cols-[minmax(0,1fr)_var(--patch-aside)] items-stretch [--patch-aside:calc(360px+var(--shell-gutter))] max-xl:[--patch-aside:calc(300px+var(--shell-gutter))] max-lg:grid-cols-[minmax(0,1fr)]",
        "before:pointer-events-none before:absolute before:top-0 before:right-[var(--patch-aside)] before:-bottom-8 before:z-1 before:border-l before:border-rule-strong before:content-[''] max-lg:before:hidden",
        className
      )}
      {...props}
    />
  )
}

export function PatchFeed({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("min-w-0", className)} {...props} />
}

export function PatchSidebar({ className, ...props }: ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "min-w-0 max-lg:mt-8 max-lg:border-t max-lg:border-rule-strong",
        className
      )}
      {...props}
    />
  )
}

/* A tinted strip: a mono label with a count or a link beside it, closed by
   a rule that meets the divider. */
export function PatchStrip({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex min-h-14 items-center justify-between gap-3 border-b border-rule-strong bg-[color-mix(in_oklch,var(--color-surface)_60%,var(--color-paper))] py-3 mono-label text-ink-muted",
        gutter,
        className
      )}
      {...props}
    />
  )
}

export function PatchStripTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("mono-label text-ink", className)} {...props} />
}

export function PatchStripLink({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-brand hover:text-brand-ink",
        className
      )}
      {...props}
    />
  )
}

/* Mono caption beside a feed row: the date, a link-out marker. */
export const feedCaption =
  "font-mono text-label font-medium leading-none tracking-[0.06em] uppercase text-ink-muted"

/* A feed row that lights up on hover; the whole row is the link. */
export const feedRow =
  "border-b border-rule text-ink transition-[background-color,color] duration-120 hover:bg-notice"

export { gutter }
