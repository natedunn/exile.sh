import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import { useQueries } from "@tanstack/react-query"
import type { GemCatalogue, GemReference } from "../../shared/gems"
import { DEFAULT_TREE_VERSION, isTreeVersion } from "../../shared/tree-versions"
import { Popover, PopoverTrigger, PopoverTitle } from "./ui/popover"
import { InspectionTooltipContent } from "./tooltip-pins"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { GemTooltipContent } from "./skill-gems"
import { PassiveNodeEffects } from "./passive-node-effects"
import { PassiveNodeImage } from "./passive-node-image"

const TreeVersion = createContext<string | undefined>(undefined)
export const ItemTreeVersionProvider = TreeVersion.Provider

export function allocatedNodeName(text: string) {
  return text
    .replace(/\{[^}]*\}/g, "")
    .match(/^Allocates\s+(.+)$/i)?.[1]
    .trim()
}

export type ItemNodeReference = {
  name: string
  stats: string[]
  options?: string[]
  image?: string
}

export function useItemNodeReference(names: string[]) {
  const requested = useContext(TreeVersion)
  const version = requested ?? DEFAULT_TREE_VERSION
  const unique = [...new Set(names.map((name) => name.toLowerCase()))]
  const queries = useQueries({
    queries: unique.map((name) => ({
      queryKey: ["item-node-reference", "v1", version, name],
      enabled: isTreeVersion(version),
      staleTime: Infinity,
      retry: false,
      queryFn: async (): Promise<ItemNodeReference> => {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(name)
        )
        const key = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0")
        )
          .join("")
          .slice(0, 24)
        const response = await fetch(
          `/pob-trees/node-reference-v1/${version}/${key}.json`,
          { signal: AbortSignal.timeout(10_000) }
        )
        if (!response.ok) throw new Error("Node reference unavailable")
        return response.json()
      },
    })),
  })
  return (name: string) => queries[unique.indexOf(name.toLowerCase())]
}

export function ItemReferenceTooltip({
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
        fallbackClose
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

export function GrantedSkillDetails({
  name,
  line,
  reference,
  catalogue,
}: {
  name: string
  line: string
  reference?: GemReference
  catalogue?: GemCatalogue
}) {
  const level =
    line
      .replace(/\{[^}]*\}/g, "")
      .match(/Grants Skill:\s*Level\s+(\d+)\s/i)?.[1] ?? ""
  return (
    <GemTooltipContent
      catalogue={catalogue}
      gem={{
        name,
        skillId: reference?.skillId,
        level,
        quality: "0",
        enabled: true,
        support: false,
      }}
    />
  )
}

export function AnointedNodeDetails({
  name,
  reference,
}: {
  name: string
  reference: ReturnType<ReturnType<typeof useItemNodeReference>> | undefined
}) {
  const node = reference?.data
  const image = node?.image
  return (
    <>
      <div>
        <PassiveNodeImage src={image} width={48} height={48} />
        <div className="tree-inspect-heading">
          <PopoverTitle>{name}</PopoverTitle>
          <p className="tree-status" data-allocated="true">
            Allocated by anointment
          </p>
        </div>
      </div>
      {node ? (
        <PassiveNodeEffects node={node} />
      ) : (
        <p role="status">
          {reference?.isFetching
            ? "Loading passive details…"
            : "Passive details are unavailable for this tree version."}
        </p>
      )}
    </>
  )
}
