import { hasReference, ReferenceLine } from "./reference-tooltip"
import { useCopyItem } from "../lib/use-copy-item"
import { groupItemAugments } from "../../shared/item-tooltip"
import type { Augment } from "../../shared/item-tooltip"
import type {
  ItemLine,
  EquipmentDetails,
  EquipmentItem,
} from "../../shared/equipment"
import { Gem } from "lucide-react"
import { Button } from "./ui/button"
import { Kbd } from "./ui/kbd"
import { PopoverTitle, PopoverDescription } from "./ui/popover"
import { useAffixLayout } from "../lib/item-display-settings"
import { useBondedModifiers } from "./item-display-settings-provider"

const properties =
  "grid gap-(--equipment-line-gap) text-left font-sans text-(length:--equipment-modifier-font-size) leading-(--equipment-line-height) data-[layout=centered]:text-center [&>div]:flex [&>div]:justify-start [&>div]:gap-1 data-[layout=centered]:[&>div]:justify-center [&_dt]:text-ink-muted [&_dt]:after:content-[':'] [&_dd]:m-0 [&_dd]:text-left [&_dd]:text-ink [&_dd]:tabular-nums data-[layout=centered]:[&_dd]:text-center"

const modifiers =
  "font-sans text-(length:--equipment-modifier-font-size) leading-(--equipment-line-height) font-medium text-item-modifier [&_[data-kind=crafted]]:text-item-crafted [&_[data-kind=enchant]]:text-item-augment [&_[data-kind=fractured]]:text-item-fractured [&_[data-kind=desecrated]]:text-item-desecrated [&_[data-kind=mutated]]:text-negative [&_[data-kind=corrupted]]:text-negative [&_[data-corrupted=true]]:text-negative [&_[data-corrupted=true]]:mt-3 [&_[data-corrupted=true]]:flex [&_[data-corrupted=true]]:items-center [&_[data-corrupted=true]]:gap-3 [&_[data-corrupted=true]]:corrupted-rule [&_[data-corrupted=true]]:mx-[calc(-1*var(--equipment-content-inset))] data-[layout=bullets]:[&_[data-corrupted=true]]:ms-0 data-[layout=bullets]:[&_[data-corrupted=true]]:before:hidden [&_[data-explicit=true]>[data-kind=normal]]:text-item-explicit"

const affixGroup =
  "m-0 list-none p-0 text-center [&+&]:mt-1.75 [&+&]:border-t [&+&]:border-rule-strong [&+&]:pt-1.75 [&>li]:my-(--equipment-line-gap) [&>li]:wrap-anywhere [&>li::marker]:[color:color-mix(in_srgb,currentColor_50%,transparent)] [&>li[data-kind=desecrated]]:desecrated-wash data-[explicit=true]:[&>[data-kind=normal]]:text-item-explicit in-data-[layout=bullets]:list-disc in-data-[layout=bullets]:text-left in-data-[layout=bullets]:[&>li:not([data-granted-skill=true]):not([data-augment=true])]:[--equipment-affix-indent:1.25em] in-data-[layout=bullets]:[&>li:not([data-granted-skill=true]):not([data-augment=true])]:ml-(--equipment-affix-indent) in-data-[layout=bullets]:[&>li:is([data-augment=true],[data-granted-skill=true])]:flex in-data-[layout=bullets]:[&>li:is([data-augment=true],[data-granted-skill=true])]:items-start in-data-[layout=bullets]:[&>li:is([data-augment=true],[data-granted-skill=true])]:justify-start in-data-[layout=bullets]:[&>li:is([data-augment=true],[data-granted-skill=true])]:gap-2 in-data-[layout=bullets]:[&>li:is([data-augment=true],[data-granted-skill=true])]:text-left [&>li:is([data-augment=true],[data-granted-skill=true])]:list-none"

export function ItemTooltipContent({
  item,
  details,
  slot,
  copyStatus = "",
  inline = false,
}: {
  item: EquipmentItem
  details: EquipmentDetails
  slot: string
  copyStatus?: string
  /** Rendered in the page rather than a popover: plain headings and no
   * inspection footer. */
  inline?: boolean
}) {
  const affixLayout = useAffixLayout()
  const bonded = useBondedModifiers()
  const clipboard = useCopyItem(item.text)
  const augments = groupItemAugments(details)
  const visible = (lines: ItemLine[]) =>
    lines.filter(
      (line) => bonded.enabled || !/^(?:\{[^}]*\})*Bonded:/i.test(line.text)
    )
  function augmentIcons(sources: Augment[]) {
    return (
      <span className="inline-flex shrink-0 gap-1 align-middle [&_img]:size-6 [&_img]:object-contain [&_svg]:size-6">
        {sources.map((augment) => {
          const label =
            augment.name + (augment.count > 1 ? ` ×${augment.count}` : "")
          return augment.image ? (
            <img
              key={augment.name}
              src={augment.image}
              width={24}
              height={24}
              alt={label}
              title={label}
            />
          ) : (
            <Gem key={augment.name} size={24} role="img" aria-label={label} />
          )
        })}
      </span>
    )
  }
  function renderModifiers(
    lines: ItemLine[],
    label: string,
    explicit = false,
    sources: Augment[] = []
  ) {
    const shown = visible(lines)
    if (!shown.length) return null
    return (
      <ul
        data-slot="equipment-affix-group"
        className={affixGroup}
        aria-label={label}
        role="list"
        data-explicit={explicit || undefined}
      >
        {shown.map((line, i) => (
          <li
            key={i}
            data-kind={line.kind}
            data-granted-skill={hasReference(line.text) || undefined}
            data-augment={sources.length > 0 || undefined}
          >
            {sources.length > 0 && augmentIcons(sources)}
            <ReferenceLine text={line.text} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <>
      <header
        data-slot="equipment-card-header"
        className="border-b border-(--inspection-border) px-5.5 py-3.5 text-left data-[layout=centered]:px-12 data-[layout=centered]:text-center"
        data-layout={affixLayout}
      >
        <div className="min-w-0">
          {inline ? (
            <h4 data-slot="popover-title" className="font-medium">
              {details.name}
            </h4>
          ) : (
            <PopoverTitle>{details.name}</PopoverTitle>
          )}
          {details.base && details.base !== details.name && (
            <p className="mt-1 text-sm text-(--item-color)">{details.base}</p>
          )}
          {inline ? (
            <p className="mt-1.5 font-mono text-label leading-normal text-ink-muted capitalize">
              {details.artwork?.itemClass || slot} ·{" "}
              {details.rarity.toLowerCase()}
            </p>
          ) : (
            <PopoverDescription className="mt-1.5 font-mono text-label leading-normal capitalize">
              {details.artwork?.itemClass || slot} ·{" "}
              {details.rarity.toLowerCase()}
            </PopoverDescription>
          )}
        </div>
      </header>
      <div
        className="px-(--equipment-content-inset) py-4 text-left [--equipment-content-inset:22px] data-[layout=centered]:text-center max-sm:py-3.5 max-sm:[--equipment-content-inset:16px]"
        data-layout={affixLayout}
      >
        {details.properties.length > 0 && (
          <dl
            data-slot="equipment-card-properties"
            className={properties}
            data-layout={affixLayout}
          >
            {details.properties.map((line, i) => {
              const colon = line.indexOf(":")
              const label = line.slice(0, colon)
              const value = line.slice(colon + 1).trim()
              const displayValue =
                /^quality$/i.test(label) && /^[+-]?\d+(?:\.\d+)?$/.test(value)
                  ? `${value}%`
                  : value
              return (
                <div key={i}>
                  <dt>{label}</dt>
                  <dd>{displayValue}</dd>
                </div>
              )
            })}
          </dl>
        )}
        {details.requirements.length > 0 && (
          <dl
            className={`${properties} mt-(--equipment-line-gap) first:mt-0`}
            data-layout={affixLayout}
          >
            <div>
              <dt>Requires</dt>
              <dd>{details.requirements.join(" · ")}</dd>
            </div>
          </dl>
        )}
        {(augments.groups.length > 0 || augments.unmatched.length > 0) && (
          <section
            className={`${modifiers} mt-2 border-t border-rule-strong`}
            data-layout={affixLayout}
            aria-label="Augments"
          >
            {augments.groups
              .filter(
                (group) => !group.lines.length || visible(group.lines).length
              )
              .map((group, index) => (
                <div
                  className="py-1.5 [&+&]:border-t [&+&]:border-rule"
                  key={index}
                >
                  {!group.lines.length && augmentIcons(group.augments)}
                  {renderModifiers(
                    group.lines,
                    group.augments.map((a) => a.name).join(" + ") +
                      " modifiers",
                    false,
                    group.augments
                  )}
                </div>
              ))}
            {visible(augments.unmatched).length > 0 && (
              <div className="py-1.5 [&+&]:border-t [&+&]:border-rule">
                {renderModifiers(
                  augments.unmatched,
                  "Other augment effects",
                  false,
                  [{ name: "Unknown augment", count: 1 }]
                )}
              </div>
            )}
          </section>
        )}
        {details.modifiers.length > 0 && (
          <div
            data-slot="equipment-card-modifiers"
            className={`${modifiers} border-t border-rule-strong py-1.75 first:mt-2`}
            data-layout={affixLayout}
          >
            {renderModifiers(
              details.implicitModifiers.filter(
                (line) => !details.augmentModifiers.includes(line)
              ),
              "Implicit modifiers and enchantments"
            )}
            {renderModifiers(
              details.explicitModifiers.filter(
                (line) => !details.augmentModifiers.includes(line)
              ),
              "Explicit modifiers",
              true
            )}
            {details.statuses.map((line, i) => (
              <p
                key={i}
                data-kind={line.kind}
                data-corrupted={/^(?:Twice )?Corrupted$/.test(line.text)}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
        {details.variantWarning && (
          <p className="pt-3.5 text-label text-ink-muted">
            This item includes PoB variants. Variant markers are retained; open
            the export in PoB to inspect the selected rolls.
          </p>
        )}
        {!inline && (
          <footer className="mt-3 border-t border-rule pt-2.5 text-center text-2xs leading-loose text-ink-muted">
            <span className="pointer-coarse:hidden [&_kbd]:px-1 [&_kbd]:py-0.25 [&_kbd]:text-fine">
              Hold <Kbd>Alt</Kbd> to inspect • <Kbd>P</Kbd> to keep open
              <span aria-hidden="true"> • </span>
            </span>
            <Button
              data-slot="equipment-copy"
              className="m-0 inline h-auto w-auto rounded-none border-0 p-0 align-baseline text-inherit [font:inherit]"
              variant="ghost"
              onClick={clipboard.copy}
              aria-label={
                clipboard.status || copyStatus || "Click item to copy"
              }
            >
              <span role="status">
                {clipboard.status || copyStatus || "Click item to copy"}
              </span>
            </Button>
          </footer>
        )}
      </div>
    </>
  )
}
