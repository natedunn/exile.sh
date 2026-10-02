import * as React from "react"
import { cn } from "cn"
import { GemSectionTitle } from "../gem-section"

/* The build page's sections: each opens with the gem and currency pages'
 * title voice, a bronze label trailed by a hairline, then splits into its
 * content and a column of the figures that belong to it, with a hairline
 * between. Rules run frame to frame, so the content takes the shell gutter
 * on its outer edge. Under the lg breakpoint the two columns stack. */

/** The sticky section nav is 60px, 52px under lg: sections stop below it. */
export { navigationHeight as buildNavHeightClass } from "../ui/navigation-styles"
export const buildScrollMarginClass =
  "scroll-mt-navigation max-lg:scroll-mt-navigation-compact"

export const buildSectionMainClass =
  "min-w-0 pt-4 pr-6 pb-8 pl-[var(--shell-gutter)] max-lg:px-[var(--shell-gutter)]"
export const buildSectionAsideClass =
  "sticky top-15 min-w-0 pt-4 pr-[var(--shell-gutter)] pb-8 pl-6 lg:-mt-11 max-lg:static max-lg:border-t max-lg:border-rule-strong max-lg:px-[var(--shell-gutter)]"

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

/** The title row sits over the content column, and the figures divider
 * runs up through it to the section's top rule. Controls such as set
 * pickers trail the title's hairline. */
function BuildSectionStrip({
  className,
  full = false,
  ...props
}: React.ComponentProps<"header"> & {
  /** No figures column: the row spans the section. */
  full?: boolean
}) {
  return (
    <header
      data-slot="build-section-strip"
      className={cn(
        "relative flex min-h-9 flex-wrap items-center gap-x-4 gap-y-3 px-[var(--shell-gutter)] pt-8",
        !full &&
          "lg:pr-111 lg:before:pointer-events-none lg:before:absolute lg:before:inset-y-0 lg:before:right-105 lg:before:border-l lg:before:border-rule-strong lg:before:content-['']",
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
    <GemSectionTitle
      data-slot="build-section-title"
      className={cn("min-w-0 flex-1 basis-48 px-0", className)}
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
