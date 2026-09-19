import { Link, useSearch } from "@tanstack/react-router"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "cn"
import { filters } from "../lib/economy-filters"
import { AccountLink } from "./account-link"
import { SiteNavigation } from "./site-navigation"

/* Economy filters ride along in shell links so switching sections never
   loses the reader's league or display currency. */
export function useShellFilters() {
  const search = useSearch({ strict: false })
  return { ...filters.parse(search), item: "" }
}

/* Gutter and column width for every page; features consume them through
   px-(--shell-gutter) and max-w-(--shell-max-width). */
const shellVars =
  "[--shell-max-width:1400px] [--shell-gutter:--spacing(8)] max-lg:[--shell-gutter:--spacing(6)] max-sm:[--shell-gutter:--spacing(3)]"

/* "exile" and ".sh" are separate flex items, so the gap lives on the mark
   rather than between them. */
function Wordmark() {
  const f = useShellFilters()
  return (
    <Link
      data-testid="wordmark"
      className="flex items-center font-display text-3xl leading-none font-semibold tracking-[-0.03em] text-ink max-sm:text-2xl"
      to="/economy"
      search={f}
    >
      exile<span className="text-brand italic">.sh</span>
    </Link>
  )
}

/* Masthead row: wordmark, main navigation, account. */
function Masthead({ className }: { className?: string }) {
  const f = useShellFilters()
  return (
    <div
      className={cn(
        "flex items-center gap-12 px-(--shell-gutter) max-lg:gap-4 max-sm:min-h-[55px] max-sm:flex-wrap max-sm:gap-2 max-sm:py-2",
        className
      )}
    >
      <Wordmark />
      <SiteNavigation filters={f} />
      <AccountLink />
    </div>
  )
}

/* One frame for every page: masthead, a bordered column of content, and
   the colophon. */
export function SiteLayout({ children }: { children: ReactNode }) {
  const f = useShellFilters()
  return (
    <div
      data-shell="site"
      className={cn(
        "mx-auto flex min-h-dvh max-w-(--shell-max-width) flex-col border-x border-rule-strong max-sm:border-x-0",
        shellVars
      )}
    >
      {/* Masthead: a plain hairline rule. */}
      <header
        data-testid="site-header"
        className="relative h-17 shrink-0 border-b border-rule-strong max-sm:h-auto max-sm:min-h-14"
      >
        <Masthead className="h-full" />
      </header>
      <main id="main" className="min-w-0 flex-1 px-(--shell-gutter)">
        {children}
      </main>
      <footer className="relative mt-6 flex shrink-0 items-center gap-6 border-t border-rule-strong px-(--shell-gutter) pt-6 pb-8 font-mono text-label tracking-[0.06em] text-ink-muted before:pointer-events-none before:absolute before:inset-x-0 before:-top-px before:h-[3px] before:dot-screen before:[mask-image:linear-gradient(to_left,black_10%,transparent_80%)] before:bg-[size:3px_3px] before:text-brand before:opacity-70 before:content-[''] max-sm:flex-col max-sm:items-start max-sm:gap-3">
        <Link
          data-testid="footer-brand"
          className="display text-2xl whitespace-nowrap text-ink hover:text-ink"
          to="/economy"
          search={f}
        >
          exile.sh
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="m-0 max-sm:leading-[1.6]">
            Not affiliated with or endorsed by Grinding Gear Games.
          </p>
          <span>Game content © Grinding Gear Games.</span>
        </div>
        <div className="ml-auto flex gap-6 max-sm:ml-0 max-sm:gap-4">
          <Link
            className="flex items-center gap-1.5 tracking-label whitespace-nowrap uppercase hover:text-ink"
            to="/methodology"
            search={f}
          >
            Data & attribution
          </Link>
          <a
            className="flex items-center gap-1.5 tracking-label whitespace-nowrap uppercase hover:text-ink"
            href="https://github.com/natedunn/exile.sh"
          >
            GitHub <ExternalLink size={11} />
          </a>
        </div>
      </footer>
    </div>
  )
}

/** Viewport-sized workspace for interactive viewers with their own pan and zoom. */
export function ViewerLayout({ children }: { children: ReactNode }) {
  const f = useShellFilters()
  return (
    <div
      data-shell="viewer"
      className={cn("flex h-dvh flex-col overflow-hidden", shellVars)}
    >
      <header
        data-testid="viewer-header"
        className="w-full shrink-0 border-b border-rule-strong"
      >
        <Masthead className="mx-auto h-[67px] w-full max-w-(--shell-max-width) border-x border-transparent max-sm:h-auto max-sm:min-h-[55px] max-sm:border-x-0" />
      </header>
      <main
        id="main"
        className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden"
      >
        {children}
      </main>
      <footer
        data-testid="viewer-footer"
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule-strong px-3 py-2 font-mono text-fine leading-[1.4] text-ink-muted"
      >
        <span>Game content © Grinding Gear Games.</span>
        <Link
          className="whitespace-nowrap hover:text-ink"
          to="/methodology"
          search={f}
        >
          Data & attribution
        </Link>
      </footer>
    </div>
  )
}
