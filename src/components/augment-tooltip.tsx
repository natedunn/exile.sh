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
      <header className="augment-tooltip-heading">
        {image && <img src={image} alt="" width={40} height={40} />}
        <div>
          <PopoverTitle>{name}</PopoverTitle>
          {reference && <p>{augmentTypeLabel(reference.type)}</p>}
        </div>
      </header>
      {reference ? (
        <>
          {(reference.level || reference.limit) && (
            <dl className="augment-tooltip-properties">
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
          <div className="augment-tooltip-applications">
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
                    <div className="augment-tooltip-bonded">
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
}: {
  name: string
  image?: string
  itemPopup: HTMLDivElement | null
  index: number
  activeIndex?: number
  onInspect: (index: number, open: boolean, replaceItem: boolean) => void
}) {
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
        itemPopup.getBoundingClientRect().right + GAP + AUGMENT_WIDTH >
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
  }, [open, itemPopup, onInspect, index])
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
        className="gear-socket gear-augment-trigger"
        aria-label={`${name}. Show augment details`}
      >
        {image ? (
          <img src={image} alt={name} width={64} height={64} loading="lazy" />
        ) : (
          <Gem aria-hidden="true" />
        )}
      </PopoverTrigger>
      <InspectionTooltipContent
        {...inspection.contentProps}
        initialFocus={keyboardOpened}
        finalFocus={keyboardOpened}
        pinningEnabled={false}
        pinLabel={name}
        className="augment-tooltip"
        style={{ maxHeight: availableHeight }}
        anchor={anchor}
        side="right"
        align="start"
        sideOffset={replaceItem ? 0 : GAP}
        collisionPadding={EDGE}
        collisionAvoidance={{ side: "shift", align: "shift" }}
      >
        <AugmentDetails name={name} image={image} />
      </InspectionTooltipContent>
    </Popover>
  )
}
