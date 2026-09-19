import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

/* Match the masthead's 67px content row (68px including its outer divider).
   Own the height here so feature toolbars cannot change label/underline spacing. */
function SubNavigation({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sub-navigation"
      className={cn("flex h-16.75 shrink-0 items-center gap-6", className)}
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
