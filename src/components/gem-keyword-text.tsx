import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useMemo } from "react"
import type { ReactNode } from "react"
import { Popover, PopoverTitle, PopoverTrigger } from "./ui/popover"
import { InspectionTooltipContent } from "./tooltip-pins"
import { useInspectionTooltip } from "./use-inspection-tooltip"

type Keyword = { term: string; definition: string }
type KeywordData = {
  keywords: Partial<Record<string, Keyword>>
  aliases: Record<string, string>
  descriptions: Record<string, string>
}
type KeywordIndex = {
  definitions: Partial<Record<string, Keyword>>
  aliases: Map<string, string>
  descriptions: Record<string, string>
  pattern: RegExp
}

const LIVE_KEYWORDS = "https://repoe-fork.github.io/poe2/keywords.min.json"
const KeywordContext = createContext<KeywordIndex | null>(null)

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Keyword source returned ${response.status}`)
  return response.json()
}

async function loadKeywords(): Promise<KeywordData> {
  const aliases = (await readJson("/gems/v1/keyword-aliases.json")) as {
    aliases: Record<string, string>
    descriptions: Record<string, string>
  }
  let keywords: Partial<Record<string, Keyword>>
  try {
    keywords = (await readJson(LIVE_KEYWORDS)) as Partial<
      Record<string, Keyword>
    >
    if (!keywords.Shock?.definition) throw new Error("Invalid keyword source")
  } catch {
    const snapshot = (await readJson("/gems/v1/keywords.json")) as {
      keywords: Partial<Record<string, Keyword>>
    }
    keywords = snapshot.keywords
  }
  return {
    keywords,
    aliases: aliases.aliases,
    descriptions: aliases.descriptions,
  }
}

function keywordIndex(data: KeywordData): KeywordIndex {
  const aliases = new Map(Object.entries(data.aliases))
  for (const [key, keyword] of Object.entries(data.keywords)) {
    if (!keyword?.term || !keyword.definition) continue
    aliases.set(keyword.term.toLowerCase(), key)
    if (/^[A-Z][a-zA-Z]+$/.test(key)) aliases.set(key.toLowerCase(), key)
  }
  const names = [...aliases.keys()]
    .filter((name) => data.keywords[aliases.get(name) ?? ""]?.definition)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return {
    definitions: data.keywords,
    aliases,
    descriptions: data.descriptions,
    pattern: new RegExp(`\\b(${names.join("|")})\\b`, "gi"),
  }
}

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
    queryKey: ["gem-keywords", "repoe"],
    queryFn: loadKeywords,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
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
