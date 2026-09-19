import { useEffect, useState } from "react"
import { Gem, Menu, Swords, Newspaper, Network, XIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "./ui/button"
import { cn } from "cn"
import { navigationRow, navigationItem } from "./ui/navigation-styles"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import type { Filters } from "../lib/economy-filters"

export function SiteNavigation({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
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
      {/* Underlined tab row: the active destination carries a bronze rule. */}
      <nav
        className={cn(navigationRow, "h-full text-ink-muted max-lg:hidden")}
        aria-label="Main navigation"
      >
        {destinations.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            search={to === "/economy" ? filters : {}}
            activeProps={{ "aria-current": "page" }}
            className={navigationItem}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto hidden max-lg:block">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="size-11" />}
            aria-label="Open main menu"
          >
            <Menu className="size-5.5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="h-dvh w-[min(360px,calc(100%-48px))] max-w-none gap-0 overflow-y-auto border-l border-rule-strong bg-paper pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ink transition-[transform,opacity] ease-out data-[side=right]:w-[min(360px,calc(100%-48px))] data-[side=right]:data-ending-style:translate-x-full data-[side=right]:data-starting-style:translate-x-full motion-reduce:data-[side=right]:data-ending-style:translate-x-0 motion-reduce:data-[side=right]:data-starting-style:translate-x-0 data-[side=right]:sm:max-w-none"
            aria-label="Main menu"
          >
            <SheetHeader className="gap-0 border-b border-rule p-6 pr-18">
              <SheetTitle className="m-0 font-display text-3xl leading-[1.1] font-medium tracking-normal italic">
                Main menu
              </SheetTitle>
            </SheetHeader>
            <nav
              className="flex flex-col gap-1 p-4"
              aria-label="Main navigation"
            >
              {destinations.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  search={to === "/economy" ? filters : {}}
                  activeProps={{ "aria-current": "page" }}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center gap-3 p-3 font-mono text-xs tracking-label-tight whitespace-nowrap text-ink uppercase aria-[current=page]:bg-surface aria-[current=page]:shadow-[inset_3px_0_0_var(--color-brand)]"
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-[max(--spacing(4),env(safe-area-inset-top))] right-3 size-11"
                />
              }
            >
              <XIcon className="size-3.5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
