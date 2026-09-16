import { ItemArtwork } from "./equipment-artwork"
import { ItemTooltipContent } from "./item-tooltip-content"
import { describeEquipment } from "../../shared/equipment"
import type { BuildSnapshot } from "../../shared/pob"

export function JewelCardContent({
  item,
  inline = true,
  slot = "Jewel",
  copyStatus = "",
}: {
  item: BuildSnapshot["items"][number]
  inline?: boolean
  slot?: string
  copyStatus?: string
}) {
  const details = describeEquipment(item)
  return (
    <>
      <div className="build-jewel-card-art" aria-hidden="true">
        <div className="gear-slot" data-rarity={details.rarity}>
          <ItemArtwork details={details} slot="Jewel" />
        </div>
      </div>
      <div className="build-jewel-card-body">
        <ItemTooltipContent
          item={item}
          details={details}
          slot={slot}
          copyStatus={copyStatus}
          inline={inline}
        />
      </div>
    </>
  )
}
