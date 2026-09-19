import { ItemArtwork, SlotIcon } from "./equipment-artwork"
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
import { Popover, PopoverTrigger } from "./ui/popover"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import {
  describeEquipment,
  equipmentJewelSlots,
  EQUIPMENT_SLOTS,
} from "../../shared/equipment"
import type { EquipmentItem } from "../../shared/equipment"
import type { BuildSnapshot } from "../../shared/pob"
import { EquipmentSettings } from "./equipment-settings"
import { ItemTreeVersionProvider } from "./item-reference-tooltip"
import { cn } from "cn"
import { itemCard, socket as socketClass } from "./equipment-classes"

const gearArea: Record<string, string> = {
  weapon: "col-[1/3] row-[1/5]",
  offhand: "col-[7/9] row-[1/5]",
  helmet: "col-[4/6] row-[1/3]",
  body: "col-[4/6] row-[3/6]",
  amulet: "col-start-6 row-start-3",
  "ring-left": "col-start-3 row-start-4",
  "ring-right": "col-start-6 row-start-4",
  gloves: "col-[2/4] row-[5/7]",
  belt: "col-[4/6] row-start-6",
  boots: "col-[6/8] row-[5/7]",
  "flask-life": "col-start-2 row-[7/9]",
  "flask-mana": "col-start-7 row-[7/9]",
  "charm-one":
    "col-[1/9] row-[7/9] h-[46.850394%] w-[11.184211%] justify-self-center -translate-x-full",
  "charm-two":
    "col-[1/9] row-[7/9] h-[46.850394%] w-[11.184211%] justify-self-center",
  "charm-three":
    "col-[1/9] row-[7/9] h-[46.850394%] w-[11.184211%] justify-self-center translate-x-full",
  extra: "aspect-square",
}

export function GearSlot({
  item,
  name,
  label,
  area,
  missing = false,
  jewels = [],
}: {
  item?: EquipmentItem
  name: string
  label: string
  area: string
  missing?: boolean
  jewels?: { name: string; item: EquipmentItem }[]
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
    <div
      data-slot="gear-slot"
      data-area={area}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col gap-1.75 max-sm:gap-1.25",
        gearArea[area]
      )}
    >
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
            className="item-slot focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus in-data-[slot=equipment-board]:h-full in-data-[slot=equipment-board]:p-[4%] in-data-[slot=equipment-board]:[&>img]:size-full"
            data-rarity={details.rarity}
            aria-label={`${label}: ${details.name}. Show item details`}
          >
            <ItemArtwork
              key={details.artwork?.image || item.id}
              details={details}
              slot={name}
            />
          </PopoverTrigger>
          {(details.socketContents.length > 0 || jewels.length > 0) && (
            <span
              data-slot="gear-sockets"
              className="pointer-events-none absolute top-1/2 left-1/2 grid w-[70%] -translate-x-1/2 -translate-y-1/2 grid-cols-2 gap-1 data-[count=1]:w-[35%] data-[count=1]:grid-cols-1 data-[item-class=Staff]:w-[35%] data-[item-class=Staff]:grid-cols-1 data-[item-class=Wand]:w-[35%] data-[item-class=Wand]:grid-cols-1"
              data-count={details.socketContents.length + jewels.length}
              data-item-class={details.artwork?.itemClass}
              aria-label={[
                ...details.socketContents.map((socket) => socket.name),
                ...jewels.map(({ item: socketed }) => socketed.name),
              ].join(", ")}
            >
              {details.socketContents.map((socket, i) =>
                socket.name === "Empty socket" ||
                socket.name === "Unspecified socket" ? (
                  <span
                    key={i}
                    className={socketClass}
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
              {jewels.map(({ name: socket, item: jewel }, i) => (
                <AugmentSocket
                  key={socket}
                  name={jewel.name}
                  image={describeEquipment(jewel).artwork?.image}
                  jewel={jewel}
                  index={details.socketContents.length + i}
                  activeIndex={augment?.index}
                  itemPopup={itemPopup}
                  onInspect={inspectAugment}
                />
              ))}
            </span>
          )}
          <InspectionTooltipContent
            data-tooltip-kind="item"
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
            className={itemCard}
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
          className="item-slot flex-col gap-2 border-dashed text-ink-faint opacity-50 before:hidden [&>span]:font-mono [&>span]:text-fine max-sm:[&>span]:text-micro [&>svg]:size-7.5 [&>svg]:stroke-1 [&>svg]:opacity-40 max-sm:[&>svg]:size-5"
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
      className="relative mb-4 flex justify-center"
    >
      <TabsList
        aria-label="Weapon set"
        className="h-8.5 gap-0.5 border-rule-strong bg-surface p-0.75"
      >
        <TabsTrigger
          className="px-3.5 py-1 font-mono text-label data-active:bg-brand-deep"
          value="primary"
        >
          Set I
        </TabsTrigger>
        {swappable ? (
          <TabsTrigger
            className="px-3.5 py-1 font-mono text-label data-active:bg-brand-deep"
            value="swap"
          >
            Set II
          </TabsTrigger>
        ) : (
          <TooltipProvider delay={0}>
            <Tooltip>
              {/* A disabled tab takes no pointer events, so the wrapper listens. */}
              <TooltipTrigger
                render={
                  <span
                    data-slot="equipment-weapon-switch-off"
                    className="inline-flex h-full"
                  />
                }
                tabIndex={0}
              >
                <TabsTrigger
                  className="px-3.5 font-mono text-label"
                  value="swap"
                  disabled
                >
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
    (s) =>
      !known.has(s.name) &&
      !(
        jewelSlots.has(s) &&
        [...known].some((name) => s.name.startsWith(`${name} Jewel Socket `))
      )
  )
  function slotItem(name: string) {
    const slot = equipped.find((s) => s.name === name)
    return {
      item: build.items.find((item) => item.id === slot?.itemId),
      missing: !!slot,
    }
  }
  return (
    <div className="mx-auto max-w-235 in-data-[slot=build-section]:max-w-none">
      <div className="relative flex flex-col items-center border-b border-rule-strong p-8 max-sm:px-3 max-sm:py-4">
        <div className="inspection-field mx-auto flex w-full flex-1 flex-col items-center justify-center p-8 max-sm:p-4">
          <EquipmentSettings />
          {onWeaponsChange && (
            <WeaponSetSwitch
              value={weapons}
              onChange={onWeaponsChange}
              swappable={swappable}
            />
          )}
          <div
            data-slot="equipment-board"
            className="relative mx-auto grid aspect-square min-h-0 w-full max-w-170 grid-cols-8 grid-rows-8 gap-[1.503759%]"
            aria-label="Equipped items"
          >
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
                  jewels={[...jewelSlots]
                    .filter((socket) =>
                      socket.name.startsWith(`${name} Jewel Socket `)
                    )
                    .flatMap((socket) => {
                      const item = build.items.find(
                        (entry) => entry.id === socket.itemId
                      )
                      return item ? [{ name: socket.name, item }] : []
                    })}
                  {...slotItem(name)}
                />
              )
            })}
          </div>
        </div>
      </div>
      {extras.length > 0 && (
        <section data-slot="equipment-extras" className="mt-7">
          <h3 className="mb-4 font-display text-xl">Additional equipment</h3>
          <div className="grid grid-cols-[repeat(auto-fill,128px)] gap-4">
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
