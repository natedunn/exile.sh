import { useState } from "react"
import type { EquipmentDetails } from "../../shared/equipment"
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

export function SlotIcon({ slot }: { slot: string }) {
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
                : slot.includes("Charm") ||
                    slot === "Amulet" ||
                    slot === "Jewel"
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
