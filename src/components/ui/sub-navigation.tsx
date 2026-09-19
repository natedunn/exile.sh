import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { navigationContentHeight, navigationRow } from "./navigation-styles"

/* Use Build Bin's spacing, leaving one pixel for the enclosing divider. */
function SubNavigation({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sub-navigation"
      className={cn(
        navigationRow,
        navigationContentHeight,
        "shrink-0",
        className
      )}
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
      className={cn("h-full gap-2", className)}
      render={render}
      nativeButton={nativeButton ?? !render}
      role={render ? "link" : undefined}
      {...props}
    />
  )
}

export { SubNavigation, SubNavigationItem }
