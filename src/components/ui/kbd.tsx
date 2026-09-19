import type { ComponentProps } from "react"
import { cn } from "cn"

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "rounded border border-rule-strong px-1 py-0.25 font-[inherit] text-fine text-ink-muted",
        className
      )}
      {...props}
    />
  )
}
