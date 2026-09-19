import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

const popoverContentVariants = cva(
  "z-50 flex origin-(--transform-origin) flex-col rounded border text-ink outline-hidden transition-none",
  {
    variants: {
      variant: {
        default:
          "w-72 gap-2.5 border-rule-strong bg-surface p-2.5 text-sm shadow-menu",
        /* Shared shell for item, gem and passive inspection, live or pinned.
           Content sets --inspection-width/-padding/-border/-accent. */
        inspection:
          "dither-fade block max-h-(--inspection-max-height,var(--available-height,calc(100dvh-24px))) w-(--inspection-width,330px) max-w-[calc(100vw-24px)] gap-0 overflow-auto overscroll-contain border-(--inspection-border,var(--color-rule-strong)) bg-paper-deep p-(--inspection-padding,18px_18px_16px) shadow-popup [--dither-color:var(--inspection-accent,var(--color-brand))] [--dither-opacity:0.07] data-closed:hidden",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  collisionAvoidance,
  collisionPadding,
  anchor,
  positionMethod,
  positionerClassName,
  positionerAdornment,
  variant = "default",
  ...props
}: PopoverPrimitive.Popup.Props &
  VariantProps<typeof popoverContentVariants> & {
    positionerClassName?: string
    positionerAdornment?: React.ReactNode
  } & Pick<
    PopoverPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    | "collisionAvoidance"
    | "collisionPadding"
    | "anchor"
    | "positionMethod"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        data-slot="popover-positioner"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionAvoidance={collisionAvoidance}
        collisionPadding={collisionPadding}
        anchor={anchor}
        positionMethod={positionMethod}
        className={cn(
          "popup-corners isolate z-50 [&:has(>[data-augment-replaced=true])]:pointer-events-none [&:has(>[data-augment-replaced=true])]:invisible",
          positionerClassName
        )}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(popoverContentVariants({ variant }), className)}
          {...props}
        />
        {positionerAdornment}
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-ink-muted", className)}
      {...props}
    />
  )
}

export {
  popoverContentVariants,
  Popover,
  PopoverContent,
  PopoverClose,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
