import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

/* A bordered row of buttons for changing a value in place. */
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
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "render" | "nativeButton"
>) {
  return <Button variant="segment" size={size} {...props} />
}

export { SegmentedControl, SegmentedControlItem }
