import { keywordIndex, loadGemKeywords } from "../lib/gem-keywords"
import type { Keyword, KeywordIndex } from "../lib/gem-keywords"
import { dataReleaseKey } from "../../shared/data-assets"
import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useMemo } from "react"
import type { ReactNode } from "react"
import { Popover, PopoverTitle, PopoverTrigger } from "./ui/popover"
import { InspectionTooltipContent } from "./tooltip-pins"
import { useInspectionTooltip } from "./use-inspection-tooltip"

const KeywordContext = createContext<KeywordIndex | null>(null)

function plainDefinition(definition: string) {
  return definition
    .replace(
      /\[([^|\]]+)(?:\|([^\]]+))?\]/g,
      (_, id: string, label?: string) => label || id
    )
    .replace(/\r\n/g, "\n")
}

function GemKeyword({ label, keyword }: { label: string; keyword: Keyword }) {
  const inspection = useInspectionTooltip({ nested: true })
  return (
    <Popover {...inspection.popoverProps}>
      <PopoverTrigger
        {...inspection.triggerProps}
        render={<span />}
        nativeButton={false}
        data-slot="gem-keyword"
        aria-label={`${label}. Show keyword details`}
        className="inline cursor-pointer border-0 bg-transparent p-0 text-inherit underline decoration-current decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {label}
      </PopoverTrigger>
      <InspectionTooltipContent
        {...inspection.contentProps}
        data-tooltip-kind="keyword"
        pinningEnabled={false}
        pinLabel={keyword.term}
        side="top"
        align="start"
        sideOffset={14}
        collisionPadding={12}
        collisionAvoidance={{ side: "flip", align: "shift" }}
      >
        <PopoverTitle>{keyword.term}</PopoverTitle>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink">
          {plainDefinition(keyword.definition)}
        </p>
      </InspectionTooltipContent>
    </Popover>
  )
}

export function GemKeywordProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: [dataReleaseKey, "gem-keywords", "repoe"],
    queryFn: loadGemKeywords,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
  const index = useMemo(() => (data ? keywordIndex(data) : null), [data])
  return (
    <KeywordContext.Provider value={index}>{children}</KeywordContext.Provider>
  )
}

export function GemKeywordText({
  text,
  sourceSkillId,
}: {
  text: string
  sourceSkillId?: string
}) {
  const index = useContext(KeywordContext)
  if (!index) return text
  const source = sourceSkillId && index.descriptions[sourceSkillId]
  if (sourceSkillId && (!source || plainDefinition(source) !== text))
    return text
  const parts = source
    ? source.split(/(\[[^\]]+\])/g)
    : text.split(index.pattern)
  return parts.map((part, partIndex) => {
    const sourceLink = source && /^\[([^|\]]+)(?:\|([^\]]+))?\]$/.exec(part)
    const label = sourceLink ? sourceLink[2] || sourceLink[1] : part
    const key = source ? sourceLink?.[1] : index.aliases.get(part.toLowerCase())
    const keyword = key ? index.definitions[key] : undefined
    if (!keyword?.definition) return label
    return <GemKeyword key={partIndex} label={label} keyword={keyword} />
  })
}
