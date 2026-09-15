import { AlignCenter, List, Settings } from "lucide-react"
import {
  setAffixLayout,
  useAffixLayout,
  setShowBondedModifiers,
} from "../lib/item-display-settings"
import { useBondedModifiers } from "./item-display-settings-provider"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function EquipmentSettings() {
  const layout = useAffixLayout()
  const bonded = useBondedModifiers()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="equipment-settings-trigger"
          />
        }
        aria-label="Equipment settings"
      >
        <Settings aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="equipment-settings-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Item affixes</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={layout}
            onValueChange={(value) => {
              if (value === "centered" || value === "bullets")
                setAffixLayout(value)
            }}
          >
            <DropdownMenuRadioItem value="centered">
              <AlignCenter aria-hidden="true" /> Centered
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bullets">
              <List aria-hidden="true" /> Left aligned with bullets
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={bonded.enabled}
            disabled={bonded.automatic}
            onCheckedChange={setShowBondedModifiers}
          >
            Bonded modifiers
          </DropdownMenuCheckboxItem>
          {bonded.automatic && (
            <p className="equipment-settings-note">
              Enabled by Wisdom of the Maji in this build.
            </p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
