import * as React from "react"
import { cn } from "cn"

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

export { SubNavigation }
