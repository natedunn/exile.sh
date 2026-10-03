import { cn } from "cn"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { BaseReference, ItemReference } from "../../shared/item-registry"
import { baseStatRows, uniqueModifiers } from "../../shared/item-registry"
import { ItemRegistryImage } from "./item-registry-image"
import { Badge } from "./ui/badge"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { InspectionTooltipContent } from "./tooltip-pins"
import { Popover, PopoverTrigger } from "./ui/popover"
import { ItemTooltipContent } from "./item-tooltip-content"
import { BookmarkToggle } from "./bookmark-toggle"
import { resultCell } from "./result-grid"
import { itemCard } from "./equipment-classes"
import type {
  EquipmentDetails,
  EquipmentItem,
  ItemLine,
} from "../../shared/equipment"
import { pointerAnchor } from "../lib/pointer-anchor"
import type { ItemSearch } from "../routes/items"

const itemNameClass = {
  unique: "text-sm font-medium text-item-unique",
  base: "text-sm font-medium",
}

export function ItemResult({
  item,
  base,
  search,
  bookmarked,
  onBookmarkedChange,
  className = resultCell,
}: {
  item: ItemReference
  /** The unique's own base, for the stats in the tooltip. */
  base?: ItemReference
  search: ItemSearch
  bookmarked: boolean
  onBookmarkedChange: () => void
  className?: string
}) {
  const inspection = useInspectionTooltip({ stickyShortcut: true })
  const card = registryEquipment(
    item,
    item.kind === "base" ? item : base?.kind === "base" ? base : undefined
  )
  const [hoverAnchor, setHoverAnchor] = useState<{
    getBoundingClientRect: () => DOMRect
  }>()

  return (
    // The whole card, bookmark included, takes the hover and open state.
    <li
      className={cn(
        "flex min-w-0 items-stretch transition-colors duration-160 hover:bg-hover has-[[data-popup-open]]:bg-hover has-[a:focus-visible]:bg-hover motion-reduce:transition-none",
        className
      )}
    >
      <Popover {...inspection.popoverProps}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <Link
              to="/items/$item"
              params={{ item: item.slug }}
              // The list's query and page stay on the list, so an item page
              // is free to use its own search.
              search={{
                ...search,
                q: "",
                page: 1,
                variant: undefined,
                baseForm: undefined,
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
          className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4 text-ink no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus max-sm:pl-3"
          aria-label={`${item.name}. View item details`}
        >
          <ItemRegistryImage src={item.image} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <strong className={`truncate ${itemNameClass[item.kind]}`}>
              {item.name}
            </strong>
            <span className="flex min-w-0 items-center gap-2 font-mono text-label text-ink-muted">
              <span className="truncate">
                {item.kind === "unique" ? item.baseName : item.itemClass}
              </span>
              {item.kind === "base" && item.form !== "original" && (
                <Badge variant="outline">{item.form}</Badge>
              )}
            </span>
            <span className="truncate text-xs text-ink-muted">
              {item.kind === "unique"
                ? (item.modifiers.find((mod) => !mod.variants.length)?.text ??
                  item.itemClass)
                : item.implicits.join(" · ") ||
                  "View base stats and modifier reference"}
            </span>
          </span>
        </PopoverTrigger>
        <InspectionTooltipContent
          data-tooltip-kind="item"
          {...inspection.contentProps}
          pinId={`item:${item.slug}`}
          pinLabel={`${item.name} item details`}
          className={itemCard}
          data-rarity={card.details.rarity}
          side="right"
          align="start"
          sideOffset={14}
          collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          anchor={
            inspection.contentProps["data-hover-only"] ? hoverAnchor : undefined
          }
        >
          <ItemTooltipContent
            item={card.equipment}
            details={card.details}
            slot={item.itemClass}
          />
        </InspectionTooltipContent>
      </Popover>
      <BookmarkToggle
        name={item.name}
        bookmarked={bookmarked}
        onBookmarkedChange={onBookmarkedChange}
      />
    </li>
  )
}

const requirementLabel: Record<string, string> = {
  level: "Level",
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence",
}

/** A registry item in the shape the Build Bin's item card reads, with PoB
 * import text for its copy button. Uniques show their first variant;
 * complex ones keep only the modifiers every variant shares. */
function registryEquipment(item: ItemReference, base?: BaseReference) {
  const rarity = item.kind === "unique" ? "UNIQUE" : "NORMAL"
  const baseName = item.kind === "unique" ? item.baseName : item.name
  const properties = (base ? baseStatRows(base) : [])
    .filter(
      (row) => !row.label.startsWith("Requires ") && row.label !== "Drop level"
    )
    .map((row) => `${row.label}: ${row.value}`)
  const requirements = Object.entries(base?.requirements ?? {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${requirementLabel[key] ?? key} ${value}`)
  const effects =
    item.kind === "unique"
      ? item.complex
        ? item.modifiers.filter((mod) => !mod.variants.length)
        : uniqueModifiers(item, item.variants[0]?.id ?? 0)
      : []
  const implicits =
    item.kind === "unique"
      ? item.complex
        ? []
        : effects.slice(0, item.implicitCount).map((mod) => mod.text)
      : item.implicits
  const explicits =
    item.kind === "unique"
      ? (item.complex ? effects : effects.slice(item.implicitCount)).map(
          (mod) => mod.text
        )
      : []
  const line = (text: string): ItemLine => ({ text, kind: "normal" })
  const modifiers = [...implicits, ...explicits].map(line)
  const equipment: EquipmentItem = {
    id: item.slug,
    name: item.name,
    rarity,
    text: [
      `Rarity: ${rarity}`,
      item.name,
      ...(item.kind === "unique" ? [baseName] : []),
      ...Object.entries(base?.requirements ?? {})
        .filter(([key, value]) => value > 0 && key in requirementTag)
        .map(([key, value]) => `${requirementTag[key]}: ${value}`),
      `Implicits: ${implicits.length}`,
      ...implicits,
      ...explicits,
    ].join("\n"),
  }
  const details: EquipmentDetails = {
    name: item.name,
    base: baseName,
    rarity,
    artwork: undefined,
    properties,
    requirements,
    modifiers,
    implicitModifiers: modifiers.slice(0, implicits.length),
    explicitModifiers: modifiers.slice(implicits.length),
    augmentModifiers: [],
    statuses: [],
    sockets: [],
    socketCount: 0,
    socketContents: [],
    variantWarning: false,
  }
  return { equipment, details }
}

const requirementTag: Record<string, string> = {
  level: "LevelReq",
  strength: "StrReq",
  dexterity: "DexReq",
  intelligence: "IntReq",
}
