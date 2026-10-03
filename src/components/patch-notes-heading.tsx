import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { cn } from "cn"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "./ui/page-heading"

/* The patch notes masthead follows the gem and item pages: a serif title
   over a mono meta line, dithered art bleeding in from the right, the way
   back pinned to the top-left corner and actions to the bottom-right.
   Post titles are long, so a post's title wraps beside the art. */
export function PatchNotesHeading({
  title,
  meta,
  back = false,
  actions,
}: {
  title: ReactNode
  meta?: ReactNode
  /** A post page: link back to the index and let the title wrap. */
  back?: boolean
  actions?: ReactNode
}) {
  return (
    <PageHeading
      className={cn(
        "-mx-[var(--shell-gutter)] px-[var(--shell-gutter)]",
        back && "pt-12 max-lg:flex-wrap"
      )}
    >
      {back && (
        <Link
          to="/patch-notes"
          className="absolute top-4 left-[var(--shell-gutter)] z-2 mono-label text-ink-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← All patch notes
        </Link>
      )}
      {/* The masthead portrait, baked to the heading's window and dissolved
          radially toward every edge (scripts/dither-art.mjs), shown at twice
          its pixels. */}
      <img
        src="/art/patch-notes-masthead.png"
        alt=""
        aria-hidden="true"
        width="170"
        height="100"
        decoding="async"
        fetchPriority="high"
        className="pointer-events-none absolute top-0 right-0 z-0 h-full max-h-50 w-auto opacity-85 select-none [image-rendering:pixelated] max-sm:opacity-45"
      />
      <PageHeadingCopy className={cn(back && "max-w-3xl")}>
        <PageTitle
          className={cn(
            back &&
              "text-5xl leading-[1.1] wrap-anywhere whitespace-normal max-sm:text-4xl"
          )}
        >
          {title}
        </PageTitle>
        {meta && <PageMeta>{meta}</PageMeta>}
      </PageHeadingCopy>
      {actions && (
        <div className="relative z-1 ml-auto flex shrink-0 gap-2">
          {actions}
        </div>
      )}
    </PageHeading>
  )
}
