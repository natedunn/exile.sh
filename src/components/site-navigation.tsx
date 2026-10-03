import { useEffect, useState } from "react"
import {
  Gem,
  Menu,
  Swords,
  Newspaper,
  Network,
  Diamond,
  Package,
  Settings,
  UserRound,
  XIcon,
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "./ui/button"
import { Badge, StatusDot } from "./ui/badge"
import { cn } from "cn"
import { useAccount } from "../lib/use-account"
import { usePatchFreshness } from "../lib/use-patch-freshness"
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

/* Marks Patch Notes while there is something the reader hasn't seen. */
function NewBadge() {
  return (
    <Badge variant="notice" className="tracking-[0.06em]">
      New
    </Badge>
  )
}

export function SiteNavigation({ filters }: { filters: Filters }) {
  const [open, setOpen] = useState(false)
  const { hasNew } = usePatchFreshness()
  const isAuthenticated = useAccount().status === "member"
  useEffect(() => {
    const breakpoint = getComputedStyle(document.documentElement)
      .getPropertyValue("--breakpoint-lg")
      .trim()
    const desktop = window.matchMedia(`(min-width: ${breakpoint})`)
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
    { label: "Gems", to: "/gems", icon: Diamond },
    { label: "Items", to: "/items", icon: Package },
    { label: "Trees", to: "/trees", icon: Network },
    { label: "Patch Notes", to: "/patch-notes", icon: Newspaper },
  ] as const
  return (
    <>
      {/* A hairline separates the wordmark from the destinations. */}
      <nav
        className={cn(
          navigationRow,
          "h-full border-l border-rule pl-6 max-lg:hidden"
        )}
        aria-label="Main navigation"
      >
        {destinations.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={to === "/economy" ? filters : {}}
            activeProps={{ "aria-current": "page" }}
            className={navigationItem}
          >
            <Icon aria-hidden="true" />
            {label}
            {to === "/patch-notes" && hasNew && <NewBadge />}
          </Link>
        ))}
      </nav>
      <div className="ml-auto hidden max-lg:block">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="relative size-11"
              />
            }
            aria-label={
              hasNew ? "Open main menu, new patch notes" : "Open main menu"
            }
          >
            <Menu className="size-5.5" aria-hidden="true" />
            {hasNew && <StatusDot className="absolute top-2.5 right-2.5" />}
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
                  {to === "/patch-notes" && hasNew && <NewBadge />}
                </Link>
              ))}
            </nav>
            {/* The masthead's account link moves in here below lg. */}
            <div className="border-t border-rule p-4">
              <Link
                {...(isAuthenticated
                  ? { to: "/settings" }
                  : { to: "/auth", search: { error: undefined } })}
                activeProps={{ "aria-current": "page" }}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center gap-3 p-3 font-mono text-xs tracking-label-tight whitespace-nowrap text-ink uppercase aria-[current=page]:bg-surface aria-[current=page]:shadow-[inset_3px_0_0_var(--color-brand)]"
              >
                {isAuthenticated ? (
                  <Settings size={20} aria-hidden="true" />
                ) : (
                  <UserRound size={20} aria-hidden="true" />
                )}
                {isAuthenticated ? "Settings" : "Sign in"}
              </Link>
            </div>
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
