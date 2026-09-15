import { useCopyItem } from "../lib/use-copy-item"
import { ItemTooltipContent } from "./item-tooltip-content"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { InspectionTooltipContent, TooltipPinScope } from "./tooltip-pins"
import type { TooltipPinOptions } from "./tooltip-pins"
import type { ComponentProps } from "react"
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip"
import { useCallback, useState } from "react"
import { AugmentSocket } from "./augment-tooltip"
import {
  Gem,
  Shield,
  Swords,
  FlaskConical,
  Crown,
  Hand,
  Footprints,
  Circle,
  Shirt,
} from "lucide-react"
import { Popover, PopoverTrigger } from "./ui/popover"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import {
  describeEquipment,
  equipmentJewelSlots,
  EQUIPMENT_SLOTS,
} from "../../shared/equipment"
import type { EquipmentDetails, EquipmentItem } from "../../shared/equipment"
import type { BuildSnapshot } from "../../shared/pob"
import { EquipmentSettings } from "./equipment-settings"
import { ItemTreeVersionProvider } from "./item-reference-tooltip"

function SlotIcon({ slot }: { slot: string }) {
  const Icon = slot.includes("Weapon")
    ? Swords
    : slot === "Helmet"
      ? Crown
      : slot === "Body Armour"
        ? Shirt
        : slot === "Gloves"
          ? Hand
          : slot === "Boots"
            ? Footprints
            : slot.includes("Flask")
              ? FlaskConical
              : slot.includes("Ring")
                ? Circle
                : slot.includes("Charm") || slot === "Amulet"
                  ? Gem
                  : Shield
  return <Icon aria-hidden="true" />
}
export function ItemArtwork({
  details,
  slot,
}: {
  details: EquipmentDetails
  slot: string
}) {
  const [failed, setFailed] = useState(false)
  return details.artwork?.image && !failed ? (
    <img
      src={details.artwork.image}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      width={details.artwork.width * 64}
      height={details.artwork.height * 64}
    />
  ) : (
    <span className="gear-art-fallback">
      <SlotIcon slot={slot} />
      <span>{details.name}</span>
    </span>
  )
}
export function GearSlot({
  item,
  name,
  label,
  area,
  missing = false,
}: {
  item?: EquipmentItem
  name: string
  label: string
  area: string
  missing?: boolean
}) {
  const inspection = useInspectionTooltip({ stickyShortcut: true })
  const [itemPopup, setItemPopup] = useState<HTMLDivElement | null>(null)
  const [augment, setAugment] = useState<{
    index: number
    replace: boolean
  } | null>(null)
  const inspectAugment = useCallback(
    (index: number, open: boolean, replace: boolean) => {
      setAugment((current) => {
        if (!open) return current?.index === index ? null : current
        return current?.index === index && current.replace === replace
          ? current
          : { index, replace }
      })
    },
    []
  )
  const clipboard = useCopyItem(item?.text ?? "", inspection.open)
  const details = item ? describeEquipment(item) : null
  return (
    <div className={`gear-cell gear-${area}`}>
      <span className="sr-only" role="status">
        {clipboard.status}
      </span>
      {item && details ? (
        <Popover
          {...inspection.popoverProps}
          open={inspection.open || augment !== null}
          onOpenChange={(open, event) => {
            if (
              !open &&
              augment &&
              (event.reason === "trigger-hover" || event.reason === "focus-out")
            )
              return
            inspection.popoverProps.onOpenChange?.(open, event)
            if (!open) setAugment(null)
          }}
        >
          <PopoverTrigger
            {...inspection.triggerProps}
            onClick={clipboard.copy}
            className="gear-slot"
            data-rarity={details.rarity}
            aria-label={`${label}: ${details.name}. Show item details`}
          >
            <ItemArtwork
              key={details.artwork?.image || item.id}
              details={details}
              slot={name}
            />
          </PopoverTrigger>
          {details.socketContents.length > 0 && (
            <span
              className="gear-sockets"
              data-count={details.socketContents.length}
              data-item-class={details.artwork?.itemClass}
              aria-label={details.socketContents
                .map((socket) => socket.name)
                .join(", ")}
            >
              {details.socketContents.map((socket, i) =>
                socket.name === "Empty socket" ||
                socket.name === "Unspecified socket" ? (
                  <span
                    key={i}
                    className="gear-socket"
                    aria-label={socket.name}
                  />
                ) : (
                  <AugmentSocket
                    key={i}
                    {...socket}
                    index={i}
                    activeIndex={augment?.index}
                    itemPopup={itemPopup}
                    onInspect={inspectAugment}
                  />
                )
              )}
            </span>
          )}
          <InspectionTooltipContent
            {...inspection.contentProps}
            {...(augment && {
              initialFocus: false,
              finalFocus: false,
              "data-hover-only": true,
              showPin: false,
              fallbackClose: false,
            })}
            pinId={`item:${item.id}`}
            pinLabel={`${details.name} item details`}
            className="equipment-card"
            onElementChange={setItemPopup}
            data-augment-replaced={augment?.replace || undefined}
            collisionAvoidance={{ side: "shift", align: "shift" }}
            collisionPadding={12}
            data-rarity={details.rarity}
            side="right"
            sideOffset={14}
            align="center"
          >
            <ItemTooltipContent
              item={item}
              details={details}
              slot={label}
              copyStatus={clipboard.status}
            />
          </InspectionTooltipContent>
        </Popover>
      ) : (
        <div
          className="gear-slot gear-slot-empty"
          aria-label={`${label}: ${missing ? "item missing from export" : "empty"}`}
        >
          <SlotIcon slot={name} />
          <span>{missing ? "Unavailable" : "Empty"}</span>
        </div>
      )}
    </div>
  )
}
export type WeaponSet = "primary" | "swap"
const swapSlots = new Set(["Weapon 1 Swap", "Weapon 2 Swap"])

export function equipmentHasSwap(gear: BuildSnapshot["itemSets"][number]) {
  return gear.slots.some(
    (s) => s.itemId && s.itemId !== "0" && swapSlots.has(s.name)
  )
}
export function WeaponSetSwitch({
  value,
  onChange,
  swappable = true,
}: {
  value: WeaponSet
  onChange: (value: WeaponSet) => void
  /** Without a second set the switch stays, disabled, and says why. */
  swappable?: boolean
}) {
  return (
    <Tabs
      value={swappable ? value : "primary"}
      onValueChange={(v) => onChange(v === "swap" ? "swap" : "primary")}
      className="equipment-weapon-switch"
    >
      <TabsList aria-label="Weapon set">
        <TabsTrigger value="primary">Set I</TabsTrigger>
        {swappable ? (
          <TabsTrigger value="swap">Set II</TabsTrigger>
        ) : (
          <TooltipProvider delay={0}>
            <Tooltip>
              {/* A disabled tab takes no pointer events, so the wrapper listens. */}
              <TooltipTrigger
                render={<span className="equipment-weapon-switch-off" />}
                tabIndex={0}
              >
                <TabsTrigger value="swap" disabled>
                  Set II
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>No weapon in set 2</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TabsList>
    </Tabs>
  )
}
export function EquipmentDisplay(
  props: ComponentProps<typeof EquipmentDisplayContent> & TooltipPinOptions
) {
  return (
    <ItemTreeVersionProvider value={props.treeVersion}>
      <TooltipPinScope
        pinningEnabled={props.pinningEnabled}
        maxPinnedTooltips={props.maxPinnedTooltips ?? 1}
        resetKey={`${props.gear.id}:${props.weapons}:${props.treeVersion}`}
      >
        <EquipmentDisplayContent {...props} />
      </TooltipPinScope>
    </ItemTreeVersionProvider>
  )
}
function EquipmentDisplayContent({
  build,
  gear,
  weapons = "primary",
  onWeaponsChange,
}: {
  build: BuildSnapshot
  gear: BuildSnapshot["itemSets"][number]
  weapons?: WeaponSet
  onWeaponsChange?: (value: WeaponSet) => void
  treeVersion?: string
}) {
  const swappable = equipmentHasSwap(gear)
  const equipped = gear.slots.filter((s) => s.itemId && s.itemId !== "0")
  const known = new Set<string>([
    ...EQUIPMENT_SLOTS.map((s) => s.name),
    ...swapSlots,
  ])
  const jewelSlots = new Set(equipmentJewelSlots(build, gear))
  const extras = equipped.filter(
    (s) => !known.has(s.name) && !jewelSlots.has(s)
  )
  function slotItem(name: string) {
    const slot = equipped.find((s) => s.name === name)
    return {
      item: build.items.find((item) => item.id === slot?.itemId),
      missing: !!slot,
    }
  }
  return (
    <div className="equipment-display">
      <div className="equipment-board-frame">
        <div className="equipment-board-viewport">
          <EquipmentSettings />
          {onWeaponsChange && (
            <WeaponSetSwitch
              value={weapons}
              onChange={onWeaponsChange}
              swappable={swappable}
            />
          )}
          <div className="equipment-board" aria-label="Equipped items">
            {EQUIPMENT_SLOTS.map((slot) => {
              const name =
                slot.name.startsWith("Weapon") && weapons === "swap"
                  ? `${slot.name} Swap`
                  : slot.name
              return (
                <GearSlot
                  key={`${name}-${gear.id}`}
                  name={name}
                  label={slot.label}
                  area={slot.area}
                  {...slotItem(name)}
                />
              )
            })}
          </div>
        </div>
      </div>
      {extras.length > 0 && (
        <section className="equipment-extras">
          <h3>Additional equipment</h3>
          <div>
            {extras.map((slot, i) => (
              <GearSlot
                key={`${slot.name}-${i}`}
                name={slot.name}
                label={slot.name}
                area="extra"
                {...slotItem(slot.name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
