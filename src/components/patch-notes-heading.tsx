import type { ReactNode } from "react"

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
    <section className={`market-heading ${wrap ? "patch-post-heading" : ""}`}>
      <div className="hero-orb hero-portrait" aria-hidden="true">
        <img
          src="/art/patch-notes-dither.png"
          alt=""
          width="138"
          height="127"
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="market-heading-copy">
        <h1>{title}</h1>
        {meta && <p className="market-meta">{meta}</p>}
      </div>
    </section>
  )
}
