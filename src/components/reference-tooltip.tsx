import type { ReactNode } from "react"
import { Popover, PopoverTrigger } from "./ui/popover"
import { InspectionTooltipContent } from "./tooltip-pins"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { PassiveNodeImage } from "./passive-node-image"
import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { findNamedGem } from "../../shared/gems"
import { grantedSkillName } from "../../shared/item-tooltip"
import {
  allocatedNodeName,
  AnointedNodeDetails,
  GrantedSkillDetails,
  useItemNodeReference,
} from "./item-reference-tooltip"

/** A line of text in which one name shows its details on hover. The name
 * is underlined inside the label; the rest reads as plain text. */
export function ReferenceTooltip({
  label,
  name,
  image,
  artworkLabel,
  children,
  passive = false,
}: {
  label: string
  name: string
  image?: string
  artworkLabel: string
  children: ReactNode
  passive?: boolean
}) {
  const inspection = useInspectionTooltip({ nested: true })
  return (
    <Popover {...inspection.popoverProps}>
      {passive ? (
        <PassiveNodeImage
          className="equipment-granted-skill-art"
          src={image}
          alt={artworkLabel}
          width={24}
          height={24}
        />
      ) : (
        image && (
          <img
            className="equipment-granted-skill-art"
            src={image}
            alt={artworkLabel}
            width={24}
            height={24}
          />
        )
      )}
      <span className="equipment-reference-text">
        {label.slice(0, label.lastIndexOf(name))}
        <PopoverTrigger
          {...inspection.triggerProps}
          render={<span />}
          nativeButton={false}
          className="equipment-reference-trigger"
          aria-label={`${name}. Show ${passive ? "passive" : "skill"} details`}
        >
          {name}
        </PopoverTrigger>
        {label.slice(label.lastIndexOf(name) + name.length)}
      </span>
      <InspectionTooltipContent
        {...inspection.contentProps}
        pinningEnabled={false}
        pinLabel={name}
        className={passive ? "tree-inspection" : "skill-gem-tooltip"}
        side="right"
        align="start"
        sideOffset={14}
        collisionPadding={12}
        collisionAvoidance={{ side: "flip", align: "shift" }}
      >
        {children}
      </InspectionTooltipContent>
    </Popover>
  )
}

/** A "Grants Skill" line whose skill name opens the gem's details. */
export function SkillReference({ line }: { line: string }) {
  const skill = grantedSkillName(line)
  const catalogue = useGemCatalogue(Boolean(skill))
  if (!skill) return <span>{line}</span>
  const reference = findNamedGem(catalogue.data, skill)
  return (
    <ReferenceTooltip
      label={line}
      name={skill}
      image={reference?.image}
      artworkLabel={`${skill} skill`}
    >
      <GrantedSkillDetails
        name={skill}
        line={line}
        reference={reference}
        catalogue={catalogue.data}
      />
    </ReferenceTooltip>
  )
}

/** An "Allocates" line whose passive name opens the node's details. */
export function PassiveReference({ line }: { line: string }) {
  const node = allocatedNodeName(line)
  const lookup = useItemNodeReference(node ? [node] : [])
  if (!node) return <span>{line}</span>
  const reference = lookup(node)
  return (
    <ReferenceTooltip
      label={line}
      name={node}
      image={reference.data?.image}
      artworkLabel={`${node} passive`}
      passive
    >
      <AnointedNodeDetails name={node} reference={reference} />
    </ReferenceTooltip>
  )
}

/** Whether a modifier line names a skill or passive worth a reference. */
export function hasReference(text: string) {
  return Boolean(grantedSkillName(text) || allocatedNodeName(text))
}

/** A modifier line: its skill or passive reference when it names one,
 * plain text otherwise. Use it wherever such a line is shown. */
export function ReferenceLine({ text }: { text: string }) {
  if (grantedSkillName(text)) return <SkillReference line={text} />
  if (allocatedNodeName(text)) return <PassiveReference line={text} />
  return <span>{text}</span>
}
