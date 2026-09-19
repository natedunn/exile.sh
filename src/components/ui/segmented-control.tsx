import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

/* A bordered row of mono segments; the active one fills bronze. Items are
   Buttons (or links via render) using the segment variant. */
function SegmentedControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="segmented-control"
      className={cn(
        "inline-flex border border-rule-strong bg-surface [&>*+*]:border-l [&>*+*]:border-rule-strong",
        className
      )}
      {...props}
    />
  )
}

function SegmentedControlItem({
  size = "nav",
  render,
  nativeButton,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant">) {
  return (
    <Button
      variant="segment"
      size={size}
      render={render}
      nativeButton={nativeButton ?? !render}
      role={render ? "link" : undefined}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlItem }
