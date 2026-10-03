import { useId } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { AlignCenter, Columns2, List, Rows3 } from "lucide-react"
import {
  SettingRow,
  SettingsGroup,
  SettingsHeader,
} from "@/components/settings"
import { TreePalettePicker } from "@/components/tree-palette"
import { Checkbox } from "@/components/ui/checkbox"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import {
  setAffixLayout,
  setModifierPoolLayout,
  setShowBondedModifiers,
  useAffixLayout,
  useModifierPoolLayout,
  useShowBondedModifiers,
} from "@/lib/item-display-settings"

export const Route = createFileRoute("/settings/display")({
  head: () => ({ meta: [{ title: "Display — Settings — exile.sh" }] }),
  component: DisplaySettings,
})

/* Device preferences: the same switches the item and tree pages offer in
   place, gathered here. They live in this browser, not on the account. */
function DisplaySettings() {
  const affixes = useAffixLayout()
  const pool = useModifierPoolLayout()
  const bonded = useShowBondedModifiers()
  const affixId = useId()
  const poolId = useId()
  const paletteId = useId()
  return (
    <>
      <SettingsHeader title="Display">
        How items and passive trees are drawn. These are saved in this browser
        and do not follow your account to other devices.
      </SettingsHeader>
      <SettingsGroup
        title="Items"
        description="Applies to item tooltips, Build Bin equipment and item pages."
      >
        <SettingRow
          title={<span id={affixId}>Affix layout</span>}
          description="How modifier lines sit inside an item tooltip."
        >
          <SegmentedControl role="group" aria-labelledby={affixId}>
            {(
              [
                ["centered", "Centered", AlignCenter],
                ["bullets", "Bullets", List],
              ] as const
            ).map(([value, label, Icon]) => (
              <SegmentedControlItem
                key={value}
                className="h-10 gap-2"
                active={affixes === value}
                aria-pressed={affixes === value}
                onClick={() => setAffixLayout(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </SettingRow>
        <SettingRow
          title={<span id={poolId}>Modifier pool layout</span>}
          description="Prefixes beside suffixes, or one above the other. Narrow screens always stack."
        >
          <SegmentedControl role="group" aria-labelledby={poolId}>
            {(
              [
                ["split", "Split", Columns2],
                ["stacked", "Stacked", Rows3],
              ] as const
            ).map(([value, label, Icon]) => (
              <SegmentedControlItem
                key={value}
                className="h-10 gap-2"
                active={pool === value}
                aria-pressed={pool === value}
                onClick={() => setModifierPoolLayout(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </SettingRow>
        <SettingRow
          label
          title="Show Bonded modifiers"
          description="Builds with Wisdom of the Maji show them regardless."
        >
          <Checkbox checked={bonded} onCheckedChange={setShowBondedModifiers} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup
        title="Passive trees"
        description="Applies to the passive, atlas, ascendancy and Genesis trees."
      >
        <SettingRow
          htmlFor={paletteId}
          title="Color blindness mode"
          description="Recolours the weapon set pair so the two sets stay distinct."
        >
          <TreePalettePicker id={paletteId} className="w-64 max-sm:w-full" />
        </SettingRow>
      </SettingsGroup>
    </>
  )
}
