import type { ReactNode } from "react"
import { cn } from "cn"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "./ui/page-heading"

/* The patch notes masthead is the exchange masthead: a serif title, a mono
   meta line, and dithered art bleeding in from the right. Post titles are
   long, so they wrap instead of staying on one line. */
export function PatchNotesHeading({
  title,
  meta,
  wrap = false,
}: {
  title: ReactNode
  meta?: ReactNode
  wrap?: boolean
}) {
  return (
    <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)]">
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
        className="pointer-events-none absolute top-0 right-0 z-0 h-full max-h-50 w-auto opacity-90 select-none [image-rendering:pixelated] max-lg:opacity-60 max-sm:opacity-45"
      />
      <PageHeadingCopy
        className={cn(
          wrap && "max-w-[min(100%-220px,900px)] max-sm:max-w-none"
        )}
      >
        <PageTitle
          className={cn(
            wrap
              ? "text-5xl leading-[1.1] wrap-anywhere whitespace-normal max-sm:text-4xl"
              : "whitespace-nowrap max-lg:text-5xl"
          )}
        >
          {title}
        </PageTitle>
        {meta && (
          <PageMeta className="[&_a]:text-brand [&_a_svg]:inline [&_a_svg]:align-[-2px]">
            {meta}
          </PageMeta>
        )}
      </PageHeadingCopy>
    </PageHeading>
  )
}
