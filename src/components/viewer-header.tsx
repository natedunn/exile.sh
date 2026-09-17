import { AccountLink } from "./account-link"
import { Link, useSearch } from "@tanstack/react-router"
import { filters } from "../lib/economy-filters"
import { SiteNavigation } from "./site-navigation"

export function ViewerHeader() {
  const search = useSearch({ strict: false })
  const f = { ...filters.parse(search), item: "" }
  return (
    <header className="viewer-header">
      <div className="viewer-navigation">
        <Link className="wordmark" to="/economy" search={f}>
          exile<span>.sh</span>
        </Link>
        <SiteNavigation filters={f} />
        <AccountLink />
      </div>
    </header>
  )
}
