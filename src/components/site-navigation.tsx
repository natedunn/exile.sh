import { useEffect, useState } from "react"
import { Gem, Menu, TriangleAlert, Swords } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { LEAGUES } from "../../shared/economy"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import type { Filters } from "./economy-page"

function LeaguePicker({
  league,
  onChange,
}: {
  league: Filters["league"]
  onChange: (league: Filters["league"]) => void
}) {
  return (
    <Select
      value={league}
      onValueChange={(value) => {
        if (value) onChange(value)
      }}
      items={LEAGUES.map((value) => ({ label: value, value }))}
    >
      <SelectTrigger className="league-picker" aria-label="League" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-max">
        {LEAGUES.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SiteNavigation({
  filters,
  onLeagueChange,
  notice,
}: {
  filters: Filters
  onLeagueChange: (league: Filters["league"]) => void
  /** A data-freshness warning, shown as an icon with a tooltip. */
  notice?: string
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)")
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])
  // Both presentations use the same destinations as the site grows.
  const destinations = [
    { label: "Economy", to: "/economy", icon: Gem },
    { label: "Builds", to: "/builds", icon: Swords },
  ] as const
  return (
    <>
      <nav className="desktop-navigation" aria-label="Main navigation">
        {destinations.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            search={to === "/economy" ? { ...filters, item: "" } : {}}
            activeProps={{ className: "nav-active" }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="topbar-status">
        {notice && (
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="stale-indicator"
                  aria-label={notice}
                />
              }
            >
              <TriangleAlert aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{notice}</TooltipContent>
          </Tooltip>
        )}
        <div className="desktop-league-picker">
          <LeaguePicker league={filters.league} onChange={onLeagueChange} />
        </div>
      </div>
      <div className="mobile-navigation">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" />}
            aria-label="Open main menu"
          >
            <Menu aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="mobile-menu-sheet"
            aria-label="Main menu"
          >
            <SheetHeader>
              <SheetTitle>Main menu</SheetTitle>
            </SheetHeader>
            <nav aria-label="Main navigation">
              {destinations.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  search={to === "/economy" ? { ...filters, item: "" } : {}}

                  onClick={() => setOpen(false)}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mobile-menu-league">
              <span>League</span>
              <LeaguePicker league={filters.league} onChange={onLeagueChange} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
