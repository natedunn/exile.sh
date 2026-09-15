import {
  allocatedNodeName,
  useItemNodeReference,
  ItemReferenceTooltip,
  GrantedSkillDetails,
  AnointedNodeDetails,
} from "./item-reference-tooltip"
import { useCopyItem } from "../lib/use-copy-item"
import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { findNamedGem } from "../../shared/gems"
import { grantedSkillName, groupItemAugments } from "../../shared/item-tooltip"
import type { Augment } from "../../shared/item-tooltip"
import type {
  ItemLine,
  EquipmentDetails,
  EquipmentItem,
} from "../../shared/equipment"
import { Gem } from "lucide-react"
import { Button } from "./ui/button"
import { PopoverTitle, PopoverDescription } from "./ui/popover"
import { useAffixLayout } from "../lib/item-display-settings"
import { useBondedModifiers } from "./item-display-settings-provider"

export function ItemTooltipContent({
  item,
  details,
  slot,
  copyStatus = "",
}: {
  item: EquipmentItem
  details: EquipmentDetails
  slot: string
  copyStatus?: string
}) {
  const affixLayout = useAffixLayout()
  const bonded = useBondedModifiers()
  const clipboard = useCopyItem(item.text)
  const catalogue = useGemCatalogue(
    details.modifiers.some((line) => Boolean(grantedSkillName(line.text)))
  )
  const nodeReference = useItemNodeReference(
    details.modifiers.flatMap((line) => {
      const name = allocatedNodeName(line.text)
      return name ? [name] : []
    })
  )
  const augments = groupItemAugments(details)
  const visible = (lines: ItemLine[]) =>
    lines.filter(
      (line) => bonded.enabled || !/^(?:\{[^}]*\})*Bonded:/i.test(line.text)
    )
  function augmentIcons(sources: Augment[]) {
    return (
      <span className="equipment-augment-icons">
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
        className="equipment-affix-group"
        aria-label={label}
        role="list"
        data-explicit={explicit || undefined}
      >
        {shown.map((line, i) => {
          const skill = grantedSkillName(line.text)
          const skillReference = skill
            ? findNamedGem(catalogue.data, skill)
            : undefined
          const allocated = allocatedNodeName(line.text)
          const node = allocated ? nodeReference(allocated) : undefined
          const image = skillReference?.image ?? node?.data?.image
          return (
            <li
              key={i}
              data-kind={line.kind}
              data-granted-skill={Boolean(skill || allocated) || undefined}
              data-augment={sources.length > 0 || undefined}
            >
              {sources.length > 0 && augmentIcons(sources)}
              {skill || allocated ? (
                <ItemReferenceTooltip
                  label={line.text}
                  name={skill || allocated!}
                  image={image}
                  artworkLabel={
                    skill ? `${skill} skill` : `${allocated} passive`
                  }
                  passive={Boolean(allocated)}
                >
                  {skill ? (
                    <GrantedSkillDetails
                      name={skill}
                      line={line.text}
                      reference={skillReference}
                      catalogue={catalogue.data}
                    />
                  ) : (
                    <AnointedNodeDetails name={allocated!} reference={node} />
                  )}
                </ItemReferenceTooltip>
              ) : (
                <span>{line.text}</span>
              )}
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <>
      <header className="equipment-card-header" data-layout={affixLayout}>
        <div className="equipment-card-identity">
          <PopoverTitle>{details.name}</PopoverTitle>
          {details.base && details.base !== details.name && (
            <p className="equipment-card-base">{details.base}</p>
          )}
          <PopoverDescription className="equipment-card-type">
            {details.artwork?.itemClass || slot} ·{" "}
            {details.rarity.toLowerCase()}
          </PopoverDescription>
        </div>
      </header>
      <div className="equipment-card-scroll" data-layout={affixLayout}>
        {details.properties.length > 0 && (
          <dl className="equipment-card-properties">
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
          <dl className="equipment-card-properties equipment-card-requires">
            <div>
              <dt>Requires</dt>
              <dd>{details.requirements.join(" · ")}</dd>
            </div>
          </dl>
        )}
        {(augments.groups.length > 0 || augments.unmatched.length > 0) && (
          <section
            className="equipment-card-augments equipment-modifier-content"
            data-layout={affixLayout}
            aria-label="Augments"
          >
            {augments.groups
              .filter(
                (group) => !group.lines.length || visible(group.lines).length
              )
              .map((group, index) => (
                <div className="equipment-augment" key={index}>
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
              <div className="equipment-augment">
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
            className="equipment-card-modifiers equipment-modifier-content"
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
          <p className="equipment-card-warning">
            This item includes PoB variants. Variant markers are retained; open
            the export in PoB to inspect the selected rolls.
          </p>
        )}
        <footer className="equipment-inspection-footer">
          <span className="equipment-inspection-hint">
            Hold <kbd>Alt</kbd> to inspect • <kbd>P</kbd> to keep open
            <span aria-hidden="true"> • </span>
          </span>
          <Button
            className="equipment-copy"
            variant="ghost"
            onClick={clipboard.copy}
            aria-label={clipboard.status || copyStatus || "Click item to copy"}
          >
            <span role="status">
              {clipboard.status || copyStatus || "Click item to copy"}
            </span>
          </Button>
        </footer>
      </div>
    </>
  )
}
