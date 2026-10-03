import type * as React from "react"

/* The gems and items result grids. Cells draw their own right and bottom
   rules against the list's left rule, so a short final row closes cleanly
   under the heading rule above it. */
export const resultGrid =
  "m-0 grid list-none grid-cols-3 border-l border-rule-strong p-0 max-lg:grid-cols-2 max-md:grid-cols-1"
export const resultCell =
  "border-r border-b border-rule-strong bg-surface last:border-b"

// For a grid with no heading rule above it: every cell draws a full border
// and overlaps its neighbours by a pixel to keep the rules single.
export const framedGrid =
  "m-0 grid list-none grid-cols-3 pt-px pl-px max-lg:grid-cols-2 max-md:grid-cols-1"
export const framedCell =
  "-mt-px -ml-px border border-rule-strong bg-surface last:border-b"

/* The bookmarked results that lead a gems or items list. */
export function BookmarkedResults({
  count,
  noun,
  children,
}: {
  count: number
  /** Singular, e.g. "gem". */
  noun: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby="bookmarked-results" className="mb-8">
      <div className="mt-6 flex items-baseline justify-between gap-3 pb-2">
        <h2 id="bookmarked-results" className="font-display text-2xl text-ink">
          Bookmarks
        </h2>
        <p className="font-mono text-label text-ink-muted">
          {count} {count === 1 ? noun : `${noun}s`}
        </p>
      </div>
      <ul data-testid="bookmarked-results" className={framedGrid}>
        {children}
      </ul>
    </section>
  )
}
