import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

/* A quiet second-level navigation row. The active destination is marked by
   the same bronze bottom rule as the site masthead rather than a filled tab. */
function SubNavigation({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sub-navigation"
      className={cn("flex h-10 items-center gap-6", className)}
      {...props}
    />
  )
}

function SubNavigationItem({
  className,
  render,
  nativeButton,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      variant="subnav"
      size="bare"
      className={cn("h-full", className)}
      render={render}
      nativeButton={nativeButton ?? !render}
      role={render ? "link" : undefined}
      {...props}
    />
  )
}

export { SubNavigation, SubNavigationItem }
