import { Link, useSearch } from "@tanstack/react-router"
import { filters } from "../lib/economy-filters"
import { SiteNavigation } from "./site-navigation"

export function SiteHeader() {
  const search = useSearch({ strict: false })
  const f = { ...filters.parse(search), item: "" }
  return (
    <header className="topbar">
      <div className="topbar-content">
        <Link className="wordmark" to="/economy" search={f}>
          exile<span>.sh</span>
        </Link>
        <SiteNavigation filters={f} />
      </div>
    </header>
  )
}
