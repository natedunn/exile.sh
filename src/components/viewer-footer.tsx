import { Link, useSearch } from "@tanstack/react-router"
import { filters } from "../lib/economy-filters"

export function ViewerFooter() {
  const search = useSearch({ strict: false })
  const f = { ...filters.parse(search), item: "" }
  return (
    <footer className="viewer-footer">
      <span>Game content © Grinding Gear Games.</span>
      <Link to="/methodology" search={f}>
        Data & attribution
      </Link>
    </footer>
  )
}
