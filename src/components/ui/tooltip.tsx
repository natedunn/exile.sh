import { createContext, useContext, useId } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

const TooltipIdContext = createContext<string | undefined>(undefined)

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  const id = useId()
  return (
    <TooltipIdContext.Provider value={id}>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipIdContext.Provider>
  )
}

function TooltipTrigger({
  "aria-describedby": describedBy,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  const id = useContext(TooltipIdContext)
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      aria-describedby={
        [describedBy, id].filter(Boolean).join(" ") || undefined
      }
      {...props}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const id = useContext(TooltipIdContext)
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="popup-corners isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          id={id}
          role="tooltip"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded border border-rule-strong bg-surface px-3 py-1.5 font-sans text-xs text-ink has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
