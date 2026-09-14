import { useEffect, useState } from "react"
import { Gem, Menu, Swords, Newspaper, Network } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import type { Filters } from "../lib/economy-filters"

export function SiteNavigation({ filters }: { filters: Filters }) {
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
    { label: "Build Bin", to: "/build-bin", icon: Swords },
    { label: "Trees", to: "/trees", icon: Network },
    { label: "Patch Notes", to: "/patch-notes", icon: Newspaper },
  ] as const
  return (
    <>
      <nav className="desktop-navigation" aria-label="Main navigation">
        {destinations.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            search={to === "/economy" ? filters : {}}
            activeProps={{ className: "nav-active" }}
          >
            {label}
          </Link>
        ))}
      </nav>
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
                  search={to === "/economy" ? filters : {}}
                  activeProps={{ "aria-current": "page" }}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
