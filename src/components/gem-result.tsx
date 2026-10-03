import { cn } from "cn"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Diamond } from "lucide-react"
import type { GemHeaders, GemReference, SavedGem } from "../../shared/gems"
import { GemTooltipContent } from "./skill-gems"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { InspectionTooltipContent } from "./tooltip-pins"
import { Popover, PopoverTrigger } from "./ui/popover"
import { BookmarkToggle } from "./bookmark-toggle"
import { pointerAnchor } from "../lib/pointer-anchor"
import type { GemSearch } from "../routes/gems"

export function GemResult({
  reference,
  slug,
  match,
  level,
  quality,
  headers,
  search,
  bookmarked,
  onBookmarkedChange,
  className,
}: {
  reference: GemReference
  /** The gem's readable URL slug (shared/gem-slug). */
  slug: string
  match?: string
  level: string
  quality: string
  headers?: GemHeaders
  search: GemSearch
  bookmarked: boolean
  onBookmarkedChange: () => void
  className?: string
}) {
  const inspection = useInspectionTooltip()
  const [hoverAnchor, setHoverAnchor] = useState<{
    getBoundingClientRect: () => DOMRect
  }>()
  const gem: SavedGem = {
    name: reference.name,
    gemId: reference.gameId,
    skillId: reference.skillId,
    variantId: reference.variantId,
    level: reference.support ? "1" : level,
    quality: reference.support ? "0" : quality,
    corrupted: false,
    enabled: true,
    support: reference.support,
  }

  return (
    <li
      className={cn(
        "flex min-w-0 items-stretch border-b border-rule last:border-b-0",
        className
      )}
    >
      <Popover {...inspection.popoverProps}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <Link
              to="/gems/$gem"
              params={{ gem: slug }}
              search={{
                ...search,
                advancedQuality: undefined,
                gemLevel:
                  !reference.support && search.level > 1
                    ? search.level
                    : undefined,
                gemQuality:
                  !reference.support && search.quality > 0
                    ? search.quality
                    : undefined,
              }}
            />
          }
          {...inspection.triggerProps}
          role="link"
          onPointerEnter={(event) => {
            inspection.triggerProps.onPointerEnter?.(event)
            if (event.pointerType === "touch") return
            setHoverAnchor(pointerAnchor(event.clientX, event.clientY))
          }}
          onPointerMove={(event) => {
            inspection.triggerProps.onPointerMove?.(event)
            if (
              event.pointerType === "touch" ||
              !inspection.contentProps["data-hover-only"]
            )
              return
            const { clientX, clientY } = event
            setHoverAnchor((current) => {
              const point = current?.getBoundingClientRect()
              if (
                point &&
                Math.abs(point.x - clientX) < 48 &&
                Math.abs(point.y - clientY) < 48
              )
                return current
              return pointerAnchor(clientX, clientY)
            })
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent py-3 pr-2 pl-4 text-left text-ink hover:bg-skill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-popup-open:bg-skill-hover data-[support=true]:hover:bg-support-hover data-[support=true]:data-popup-open:bg-support-hover max-sm:pl-3"
          data-support={reference.support}
          aria-label={`${reference.name}. View ${reference.support ? "" : `level ${gem.level} `}gem details`}
        >
          <span
            className="grid size-10 shrink-0 place-items-center overflow-hidden border border-brand/40 bg-paper-deep text-ink-muted data-[support=true]:rounded-full [&_img]:size-full [&_img]:object-cover"
            data-support={reference.support}
          >
            {reference.image ? (
              <img
                src={reference.image}
                alt=""
                width={40}
                height={40}
                loading="lazy"
              />
            ) : (
              <Diamond aria-hidden="true" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <strong className="text-sm font-medium">{reference.name}</strong>
            {match && (
              <span className="truncate text-xs text-ink-muted">{match}</span>
            )}
          </span>
          <span className="shrink-0 font-mono text-label text-ink-muted max-sm:hidden">
            {reference.support ? "Support" : reference.type}
          </span>
        </PopoverTrigger>
        <InspectionTooltipContent
          {...inspection.contentProps}
          pinLabel={`${reference.name} gem details`}
          side="right"
          align="start"
          sideOffset={12}
          collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          anchor={
            inspection.contentProps["data-hover-only"] ? hoverAnchor : undefined
          }
        >
          <GemTooltipContent
            gem={gem}
            catalogue={{
              version: "v1",
              gems: { [reference.gameId]: reference },
              headers,
            }}
          />
        </InspectionTooltipContent>
      </Popover>
      <BookmarkToggle
        name={reference.name}
        bookmarked={bookmarked}
        onBookmarkedChange={onBookmarkedChange}
      />
    </li>
  )
}
