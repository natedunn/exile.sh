import { Link, useSearch } from "@tanstack/react-router"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { filters } from "../lib/economy-filters"
import { SiteNavigation } from "./site-navigation"

/* One frame for every page: masthead, a bordered column of content, and
   the colophon. Economy filters ride along in links so switching sections
   never loses the reader's league or display currency. */
export function SiteLayout({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false })
  const f = { ...filters.parse(search), item: "" }
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="wordmark" to="/economy" search={f}>
          <img src="/favicon.svg" alt="" width="30" height="30" />
          exile<span>.sh</span>
        </Link>
        <SiteNavigation filters={f} />
      </header>
      <main id="main">{children}</main>
      <footer>
        <Link className="footer-brand" to="/economy" search={f}>
          exile.sh
        </Link>
        <div className="footer-info">
          <p>Not affiliated with or endorsed by Grinding Gear Games.</p>
          <span>Game content © Grinding Gear Games.</span>
        </div>
        <div>
          <Link to="/methodology" search={f}>
            Data & attribution
          </Link>
          <a href="https://github.com/natedunn/exile.sh">
            GitHub <ExternalLink size={11} />
          </a>
        </div>
      </footer>
    </div>
  )
}
