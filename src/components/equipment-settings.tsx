import { Settings } from "lucide-react"
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
            className="absolute top-4 right-4 z-1"
          />
        }
        aria-label="Equipment settings"
      >
        <Settings aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-65 max-w-[calc(100vw-24px)]"
      >
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
              Centered
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bullets">
              Left aligned with bullets
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={bonded.enabled}
            disabled={bonded.automatic}
            onCheckedChange={setShowBondedModifiers}
          >
            Show Bonded modifiers
          </DropdownMenuCheckboxItem>
          {bonded.automatic && (
            <p className="mx-2 mt-1 mb-2 text-2xs leading-normal text-ink-muted">
              Enabled by Wisdom of the Maji in this build.
            </p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
