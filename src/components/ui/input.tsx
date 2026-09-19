import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

export const fieldClassName =
  "rounded border border-rule-strong bg-field text-ink transition-none outline-none placeholder:text-ink-muted focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus-glow disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-negative aria-invalid:focus-visible:ring-error-glow"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        "h-8 w-full min-w-0 px-2.5 py-1 text-sm touch-safe-text file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
