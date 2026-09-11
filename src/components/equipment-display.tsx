import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  Gem,
  Shield,
  Swords,
  X,
  FlaskConical,
  Crown,
  Hand,
  Footprints,
  Circle,
  Shirt,
  ChevronDown,
} from "lucide-react"
import { Button } from "./ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
} from "./ui/popover"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { describeEquipment, EQUIPMENT_SLOTS } from "../../shared/equipment"
import type { EquipmentDetails, EquipmentItem } from "../../shared/equipment"
import type { BuildSnapshot } from "../../shared/pob"

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
function ItemArtwork({
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
function ItemCard({
  item,
  details,
  slot,
}: {
  item: EquipmentItem
  details: EquipmentDetails
  slot: string
}) {
  return (
    <>
      <header className="equipment-card-header">
        <PopoverTitle>{details.name}</PopoverTitle>
        {details.base && details.base !== details.name && <p>{details.base}</p>}
        <PopoverClose
          render={
            <Button
              variant="ghost"
              size="icon"
              className="equipment-card-close"
              aria-label="Close item details"
            />
          }
        >
          <X />
        </PopoverClose>
      </header>
      <div className="equipment-card-scroll">
        <PopoverDescription className="equipment-card-type">
          {details.artwork?.itemClass || slot} · {details.rarity.toLowerCase()}
        </PopoverDescription>
        {details.properties.length > 0 && (
          <div className="equipment-card-properties">
            {details.properties.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
        {details.requirements.length > 0 && (
          <p className="equipment-card-requires">
            Requires {details.requirements.join(" · ")}
          </p>
        )}
        {details.sockets.length > 0 && (
          <div className="equipment-card-sockets">
            {details.sockets.map((line, i) => (
              <p key={i}>
                <Gem size={12} aria-hidden="true" />
                {line.replace(/^(Rune|Soul Core): /, "")}
              </p>
            ))}
          </div>
        )}
        {details.modifiers.length > 0 && (
          <div className="equipment-card-modifiers">
            {details.modifiers.map((line, i) => (
              <p
                key={i}
                data-kind={line.kind}
                data-corrupted={line.text === "Corrupted"}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
        {details.variantWarning && (
          <p className="equipment-card-warning">
            This item includes PoB variants. Variant markers are retained; open
            the export in PoB to inspect the selected rolls.
          </p>
        )}
        <Collapsible className="equipment-original">
          <CollapsibleTrigger render={<Button variant="ghost" />}>
            Original PoB text
            <ChevronDown size={13} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre>{item.text}</pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </>
  )
}
function GearSlot({
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
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)
  const [hoverOnly, setHoverOnly] = useState(false)
  const hovering = useRef(false)
  const holding = useRef(false)
  useEffect(() => {
    if (!open) return
    const release = () => {
      holding.current = false
      setHeld(false)
      if (hoverOnly && !hovering.current) setOpen(false)
    }
    const down = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        holding.current = true
        setHeld(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") release()
    }
    const blur = () => {
      release()
      setOpen(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      holding.current = false
    }
  }, [open, hoverOnly])
  const details = item ? describeEquipment(item) : null
  return (
    <div className={`gear-cell gear-${area}`}>
      {item && details ? (
        <Popover
          open={open}
          onOpenChange={(next, eventDetails) => {
            if (
              eventDetails.reason === "trigger-press" &&
              hoverOnly &&
              hovering.current
            ) {
              setOpen(true)
              return
            }
            setOpen(next)
            if (!next) setHeld(false)
          }}
        >
          <PopoverTrigger
            onPointerEnter={(event) => {
              if (event.pointerType === "touch") return
              hovering.current = true
              if (event.altKey) return
              setHoverOnly(true)
              setHeld(false)
              setOpen(true)
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "touch") return
              hovering.current = false
              if (!holding.current) setOpen(false)
            }}
            onPointerDown={(event) => {
              if (event.pointerType === "touch") setHoverOnly(false)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ")
                setHoverOnly(false)
            }}
            className="gear-slot"
            data-rarity={details.rarity}
            aria-label={`${label}: ${details.name}. Show item details`}
          >
            <ItemArtwork
              key={details.artwork?.image || item.id}
              details={details}
              slot={name}
            />
            {details.socketContents.length > 0 && (
              <span
                className="gear-sockets"
                data-count={details.socketContents.length}
                aria-label={details.socketContents
                  .map((socket) => socket.name)
                  .join(", ")}
              >
                {details.socketContents.map((socket, i) => (
                  <span key={i} title={socket.name}>
                    {socket.image && (
                      <img
                        src={socket.image}
                        alt={socket.name}
                        width={64}
                        height={64}
                        loading="lazy"
                      />
                    )}
                  </span>
                ))}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent
            className="equipment-card"
            data-hover-only={hoverOnly && !held}
            positionerClassName={
              hoverOnly && !held ? "equipment-hover-positioner" : undefined
            }
            collisionAvoidance={{ side: "shift", align: "shift" }}
            collisionPadding={12}
            data-rarity={details.rarity}
            side="right"
            sideOffset={14}
            align="center"
          >
            <ItemCard item={item} details={details} slot={label} />
          </PopoverContent>
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
export function EquipmentDisplay({
  build,
  gear,
  setPicker,
}: {
  setPicker?: ReactNode
  build: BuildSnapshot
  gear: BuildSnapshot["itemSets"][number]
}) {
  const [weapons, setWeapons] = useState("primary")
  const equipped = gear.slots.filter((s) => s.itemId && s.itemId !== "0")
  const hasSwap = equipped.some(
    (s) => s.name === "Weapon 1 Swap" || s.name === "Weapon 2 Swap"
  )
  const known = new Set<string>([
    ...EQUIPMENT_SLOTS.map((s) => s.name),
    "Weapon 1 Swap",
    "Weapon 2 Swap",
  ])
  const extras = equipped.filter((s) => !known.has(s.name))
  function slotItem(name: string) {
    const slot = equipped.find((s) => s.name === name)
    return {
      item: build.items.find((item) => item.id === slot?.itemId),
      missing: !!slot,
    }
  }
  return (
    <div className="equipment-display">
      <div className="equipment-toolbar build-section-heading">
        <h2>Equipment</h2>
        <div className="equipment-controls">
          {setPicker}
          {hasSwap && (
            <Tabs
              value={weapons}
              onValueChange={(v) => setWeapons(String(v))}
              className="equipment-weapon-switch"
            >
              <TabsList aria-label="Weapon set">
                <TabsTrigger value="primary">Set I</TabsTrigger>
                <TabsTrigger value="swap">Set II</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>
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
      <p className="equipment-footer">
        {equipped.length} saved equipment slots · Item artwork © Grinding Gear
        Games
      </p>
    </div>
  )
}
