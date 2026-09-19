import * as React from "react"
import { cn } from "cn"

/* The build page's sections: each opens with a tinted strip closed by a
 * rule, then splits into its content and a column of the figures that
 * belong to it, with a hairline between. Rules run frame to frame, so the
 * content takes the shell gutter on its outer edge. Under the lg
 * breakpoint the two columns stack. */

/** The sticky section nav is 60px, 52px under lg: sections stop below it. */
export const buildNavHeightClass = "h-15 max-lg:h-13"
export const buildScrollMarginClass = "scroll-mt-15 max-lg:scroll-mt-13"

export const buildSectionMainClass =
  "min-w-0 pt-6 pr-6 pb-8 pl-[var(--shell-gutter)] max-lg:px-[var(--shell-gutter)]"
export const buildSectionAsideClass =
  "sticky top-15 min-w-0 pt-6 pr-[var(--shell-gutter)] pb-8 pl-6 max-lg:static max-lg:border-t max-lg:border-rule-strong max-lg:px-[var(--shell-gutter)]"

function BuildSection({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="build-section"
      className={cn(
        buildScrollMarginClass,
        "border-t border-rule-strong first:border-t-0",
        className
      )}
      {...props}
    />
  )
}

function BuildSectionStrip({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="build-section-strip"
      className={cn(
        "flex min-h-18 items-center justify-between gap-4 border-b border-rule-strong bg-surface/60 px-[var(--shell-gutter)] py-3 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:py-4",
        className
      )}
      {...props}
    />
  )
}

function BuildSectionTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="build-section-title"
      className={cn("display text-section text-ink", className)}
      {...props}
    />
  )
}

function BuildSectionBody({
  className,
  full = false,
  ...props
}: React.ComponentProps<"div"> & {
  /** No figures column: the content spans the section. */
  full?: boolean
}) {
  return (
    <div
      data-slot="build-section-body"
      className={cn(
        "relative grid items-start",
        full
          ? "grid-cols-[minmax(0,1fr)]"
          : "grid-cols-[minmax(0,1fr)_420px] before:pointer-events-none before:absolute before:inset-y-0 before:right-105 before:z-1 before:border-l before:border-rule-strong before:content-[''] max-lg:grid-cols-[minmax(0,1fr)] max-lg:before:hidden",
        className
      )}
      {...props}
    />
  )
}

function BuildSectionMain({
  className,
  full = false,
  ...props
}: React.ComponentProps<"div"> & { full?: boolean }) {
  return (
    <div
      data-slot="build-section-main"
      className={cn(
        buildSectionMainClass,
        full && "pr-[var(--shell-gutter)]",
        className
      )}
      {...props}
    />
  )
}

function BuildSectionAside({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="build-section-aside"
      className={cn(buildSectionAsideClass, className)}
      {...props}
    />
  )
}

export {
  BuildSection,
  BuildSectionStrip,
  BuildSectionTitle,
  BuildSectionBody,
  BuildSectionMain,
  BuildSectionAside,
}
