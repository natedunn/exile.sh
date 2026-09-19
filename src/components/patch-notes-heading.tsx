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
      {/* The masthead portrait, shown at twice its pixels and placed so the
          face sits beside the title and the shoulders dissolve into the
          rule; a dithered bronze glow sits behind it. */}
      <div
        className="pointer-events-none absolute -top-1.5 right-2 z-0 h-[254px] w-[276px] select-none before:absolute before:-inset-20 before:bg-brand before:[mask-image:var(--dither-glow)] before:[mask-size:auto] before:[mask-position:center] before:[mask-repeat:no-repeat] before:opacity-[0.07] before:content-[''] max-lg:-right-7.5 max-sm:-right-17.5"
        aria-hidden="true"
      >
        <img
          className="absolute inset-0 size-full opacity-90 [image-rendering:pixelated] max-lg:opacity-60 max-sm:opacity-45"
          src="/art/patch-notes-dither.png"
          alt=""
          width="138"
          height="127"
          decoding="async"
          fetchPriority="high"
        />
      </div>
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
