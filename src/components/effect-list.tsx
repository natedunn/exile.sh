import type { ComponentProps } from "react"
import { cn } from "cn"

/* Stat lines for gems and passives, set in the serif as the game does.
 * Diamond markers hang in the indent; vertical-align: middle centres them
 * on the first line's x-height, so they sit true at any size. */
export function EffectList({
  className,
  hideSingleMarker = false,
  ...props
}: ComponentProps<"ul"> & { hideSingleMarker?: boolean }) {
  return (
    <ul
      className={cn(
        "m-0 list-none p-0 font-display [&>li]:pl-4 [&>li]:before:mr-2.5 [&>li]:before:-ml-3.75 [&>li]:before:inline-block [&>li]:before:size-1.25 [&>li]:before:rotate-45 [&>li]:before:bg-brand [&>li]:before:align-middle [&>li]:before:content-['']",
        hideSingleMarker &&
          "[&>li:only-child]:pl-0 [&>li:only-child]:before:content-none",
        className
      )}
      {...props}
    />
  )
}
