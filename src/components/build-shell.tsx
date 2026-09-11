import { defaultFilters } from "../lib/economy-filters"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

export function BuildShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell build-shell">
      <header className="topbar">
        <Link className="wordmark" to="/economy" search={defaultFilters}>
          <img src="/favicon.svg" alt="" width="30" height="30" />
          exile<span>.sh</span>
        </Link>
        <nav className="build-navigation" aria-label="Main navigation">
          <Link to="/economy" search={defaultFilters}>
            Economy
          </Link>
          <Link to="/builds" activeProps={{ className: "nav-active" }}>
            Builds
          </Link>
        </nav>
        <span className="build-game">Path of Exile 2</span>
      </header>
      <main id="main">{children}</main>
      <footer>
        <Link className="footer-brand" to="/builds">
          exile.sh
        </Link>
        <div className="footer-info">
          <p>Not affiliated with or endorsed by Grinding Gear Games.</p>
          <span>
            Game content © Grinding Gear Games.{" "}
            <a href="/methodology">Data sources & attribution</a>.
          </span>
        </div>
        <a href="https://github.com/natedunn/exile.sh">GitHub</a>
      </footer>
    </div>
  )
}
