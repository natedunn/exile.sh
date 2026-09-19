import * as React from "react"
import { cn } from "cn"

import { fieldClassName } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClassName,
        "flex field-sizing-content min-h-16 w-full px-2.5 py-2 text-sm touch-safe-text",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
