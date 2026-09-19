import { JewelCardContent } from "./jewel-card-content"
import type { EquipmentItem } from "../../shared/equipment"
import { useLayoutEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Gem } from "lucide-react"
import type { AugmentCatalogue } from "../../shared/augments"
import {
  augmentApplications,
  augmentTypeLabel,
  findAugment,
} from "../../shared/augments"
import { Popover, PopoverTrigger, PopoverTitle } from "./ui/popover"
import { InspectionTooltipContent } from "./tooltip-pins"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { useBondedModifiers } from "./item-display-settings-provider"
import { cn } from "cn"
import { augmentSocket, itemCard, jewelCard, socket } from "./equipment-classes"

const AUGMENT_WIDTH = 330
const GAP = 14
const EDGE = 12

function AugmentDetails({ name, image }: { name: string; image?: string }) {
  const { enabled: showBonded } = useBondedModifiers()
  const catalogue = useQuery<AugmentCatalogue>({
    queryKey: ["augment-reference", "v1"],
    queryFn: async () => {
      const response = await fetch("/augments/v1/catalogue.json")
      if (!response.ok) throw new Error("Augment reference unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  })
  const reference = findAugment(catalogue.data, name)
  return (
    <>
      <header className="mb-3 flex items-start gap-2.5 [&_img]:shrink-0 [&_img]:object-contain [&_p]:text-ink-muted">
        {image && <img src={image} alt="" width={40} height={40} />}
        <div>
          <PopoverTitle>{name}</PopoverTitle>
          {reference && <p>{augmentTypeLabel(reference.type)}</p>}
        </div>
      </header>
      {reference ? (
        <>
          {(reference.level || reference.limit) && (
            <dl className="mb-3 [&_dt]:text-ink-muted [&_dt]:after:content-[':'] [&>div]:flex [&>div]:gap-1">
              {!!reference.limit && (
                <div>
                  <dt>Limited to</dt>
                  <dd>{reference.limit}</dd>
                </div>
              )}
              {!!reference.level && (
                <div>
                  <dt>Requires</dt>
                  <dd>Level {reference.level}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="[&_h3]:font-medium [&_h3]:text-ink [&_h4]:font-medium [&_h4]:text-ink [&_p]:text-item-modifier [&>section]:border-t [&>section]:border-rule-strong [&>section]:pt-2.5 [&>section+section]:mt-2.5">
            {augmentApplications(reference)
              .filter(
                ({ lines, bonded }) =>
                  lines.length > 0 || (showBonded && bonded.length > 0)
              )
              .map(({ slots, lines, bonded }) => (
                <section key={slots.join(", ")}>
                  <h3>{slots.join(", ")}</h3>
                  {lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {showBonded && bonded.length > 0 && (
                    <div data-slot="augment-bonded" className="mt-1.5">
                      <h4>Bonded</h4>
                      {bonded.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  )}
                </section>
              ))}
          </div>
        </>
      ) : (
        <p role="status">
          {catalogue.isPending
            ? "Loading augment details…"
            : "Reference details are unavailable for this augment."}
        </p>
      )}
    </>
  )
}

export function AugmentSocket({
  name,
  image,
  itemPopup,
  onInspect,
  index,
  activeIndex,
  jewel,
}: {
  name: string
  image?: string
  jewel?: EquipmentItem
  itemPopup: HTMLDivElement | null
  index: number
  activeIndex?: number
  onInspect: (index: number, open: boolean, replaceItem: boolean) => void
}) {
  const width = jewel ? 390 : AUGMENT_WIDTH
  const inspection = useInspectionTooltip({ nested: true })
  // A sibling socket may still be inside Base UI's safe pointer-travel area.
  // The item owns which socket can display a tooltip, regardless of that area.
  const open = inspection.open && activeIndex === index
  const [replaceItem, setReplaceItem] = useState(false)
  const [availableHeight, setAvailableHeight] = useState<number>()
  const [keyboardOpened, setKeyboardOpened] = useState(false)
  useLayoutEffect(() => {
    if (!open) {
      onInspect(index, false, false)
      return
    }
    if (!itemPopup) {
      onInspect(index, true, false)
      return
    }
    const update = () => {
      setAvailableHeight(
        Math.max(0, innerHeight - itemPopup.getBoundingClientRect().top - EDGE)
      )
      const replace =
        itemPopup.getBoundingClientRect().right + GAP + width >
        innerWidth - EDGE
      setReplaceItem(replace)
      onInspect(index, true, replace)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(itemPopup)
    window.addEventListener("resize", update)
    document.addEventListener("scroll", update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
      document.removeEventListener("scroll", update, true)
    }
  }, [open, itemPopup, onInspect, index, width])
  const anchor = useMemo(
    () =>
      itemPopup
        ? {
            contextElement: itemPopup,
            getBoundingClientRect: () => {
              const rect = itemPopup.getBoundingClientRect()
              return replaceItem ? new DOMRect(rect.left, rect.top, 0, 0) : rect
            },
          }
        : undefined,
    [itemPopup, replaceItem]
  )
  return (
    <Popover
      {...inspection.popoverProps}
      open={open}
      onOpenChange={(nextOpen, event) => {
        inspection.popoverProps.onOpenChange?.(nextOpen, event)
        onInspect(index, nextOpen, nextOpen && replaceItem)
      }}
    >
      <PopoverTrigger
        data-slot="gear-augment-trigger"
        {...inspection.triggerProps}
        delay={0}
        closeDelay={0}
        onPointerEnter={(event) => {
          setKeyboardOpened(false)
          if (event.pointerType !== "touch") onInspect(index, true, replaceItem)
          inspection.triggerProps.onPointerEnter?.(event)
        }}
        onPointerDown={(event) => {
          setKeyboardOpened(false)
          inspection.triggerProps.onPointerDown?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            setKeyboardOpened(true)
          inspection.triggerProps.onKeyDown?.(event)
        }}
        className={cn(socket, augmentSocket)}
        aria-label={`${name}. Show ${jewel ? "jewel" : "augment"} details`}
      >
        {image ? (
          <img src={image} alt={name} width={64} height={64} loading="lazy" />
        ) : (
          <Gem aria-hidden="true" />
        )}
      </PopoverTrigger>
      <InspectionTooltipContent
        data-tooltip-kind={jewel ? "jewel" : "augment"}
        {...inspection.contentProps}
        initialFocus={keyboardOpened}
        finalFocus={keyboardOpened}
        pinningEnabled={false}
        pinLabel={name}
        className={
          jewel
            ? cn(itemCard, jewelCard, "gap-0 p-0")
            : "font-sans text-xs leading-[1.65] [--inspection-width:330px]"
        }
        data-rarity={jewel?.rarity.toUpperCase()}
        style={{ maxHeight: availableHeight }}
        anchor={anchor}
        side="right"
        align="start"
        sideOffset={replaceItem ? 0 : GAP}
        collisionPadding={EDGE}
        collisionAvoidance={{ side: "shift", align: "shift" }}
      >
        {jewel ? (
          <JewelCardContent item={jewel} inline={false} />
        ) : (
          <AugmentDetails name={name} image={image} />
        )}
      </InspectionTooltipContent>
    </Popover>
  )
}
