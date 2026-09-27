import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { pointerAnchor } from "../lib/pointer-anchor"
import { gemEffectsQueryOptions } from "../lib/gem-effects"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { InspectionTooltipContent, TooltipPinScope } from "./tooltip-pins"
import type { TooltipPinOptions } from "./tooltip-pins"
import type { ComponentProps } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Diamond, Droplet, Info, Star, TriangleAlert } from "lucide-react"
import {
  findGem,
  gemEffectValues,
  skillGroupLabels,
  displaySkillGroups,
} from "../../shared/gems"
import type { GemCatalogue, GemReference, SavedGem } from "../../shared/gems"
import type { BuildSnapshot } from "../../shared/pob"
import { Button } from "./ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip"
import { Popover, PopoverTitle, PopoverDescription } from "./ui/popover"
import { cn } from "cn"
import { Badge } from "./ui/badge"
import { EmptyState } from "./ui/empty-state"
import { Note } from "./ui/note"
import { EffectList } from "./effect-list"

function SkillSourceInfo({ name, labels }: { name: string; labels: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-lg" />}
        className="absolute top-2 right-2 size-8 text-ink-muted hover:border-brand hover:bg-notice-strong hover:text-brand focus-visible:border-brand focus-visible:bg-notice-strong focus-visible:text-brand data-popup-open:border-brand data-popup-open:bg-notice-strong data-popup-open:text-brand [&_svg]:size-4.5"
        aria-label={`${name}. Show skill source`}
        delay={0}
        closeOnClick={false}
        onClick={() => setOpen(true)}
      >
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent
        className="flex max-w-[min(330px,calc(100vw-24px))] flex-col items-stretch gap-2 p-4 text-xs leading-relaxed [&_p]:text-ink-muted"
        side="top"
        align="end"
      >
        <h3 className="font-display text-tooltip-heading leading-[1.1] font-medium text-brand">
          Skill source
        </h3>
        <div>
          {labels.map((label, index) => (
            <p key={index}>{label}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function GemArt({
  image,
  support,
  tooltip = false,
}: {
  image?: string
  support: boolean
  tooltip?: boolean
}) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className={cn(
        "mt-0.5 grid size-12 shrink-0 place-items-center overflow-hidden border border-brand/40 bg-paper-deep text-ink-muted data-[support=true]:rounded-full [&_img]:size-full [&_img]:object-cover",
        !tooltip &&
          "data-[support=true]:size-10 @max-[600px]:size-10 @max-[600px]:data-[support=true]:size-8.5"
      )}
      data-support={support}
    >
      {image && !failed ? (
        <img
          src={image}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <Diamond aria-hidden="true" />
      )}
    </span>
  )
}
const GemRow = memo(function GemRow({
  gem,
  catalogue,
  inspectionRef,
  activate,
  moveHover,
  main = false,
  context = [],
  leading = false,
}: {
  gem: SavedGem
  catalogue?: GemCatalogue
  inspectionRef: { current: ReturnType<typeof useInspectionTooltip> }
  activate: (
    anchor: HTMLElement,
    interactive?: boolean,
    collapse?: () => void,
    pointer?: { x: number; y: number }
  ) => void
  moveHover: (anchor: HTMLElement, x: number, y: number) => void
  main?: boolean
  context?: string[]
  leading?: boolean
}) {
  const ref = findGem(catalogue, gem)
  const tagRow = <GemTags reference={ref} support={gem.support} />
  const [expanded, setExpanded] = useState(false)
  const collapse = useCallback(() => setExpanded(false), [])
  return (
    <li
      data-slot="skill-gem-row"
      className="group/gem relative border-rule [&+&]:border-t first:[&+&]:border-rule-strong"
      data-support={gem.support}
      data-leading={leading}
      data-context={context.length > 0 || undefined}
    >
      <Button
        variant="ghost"
        size="bare"
        onPointerEnter={(event) => {
          if (
            event.pointerType !== "touch" &&
            !inspectionRef.current.contentProps.freeze
          ) {
            setExpanded(true)
            activate(event.currentTarget, false, collapse, {
              x: event.clientX,
              y: event.clientY,
            })
          }
          inspectionRef.current.triggerProps.onPointerEnter?.(event)
        }}
        onPointerMove={(event) => {
          if (
            event.pointerType === "touch" ||
            !inspectionRef.current.contentProps["data-hover-only"] ||
            inspectionRef.current.contentProps.freeze
          )
            return
          moveHover(event.currentTarget, event.clientX, event.clientY)
        }}
        onPointerLeave={(event) => {
          setExpanded(false)
          if (
            event.relatedTarget instanceof Element &&
            event.relatedTarget.closest('[data-slot="skill-gem-row"]')
          )
            return
          inspectionRef.current.triggerProps.onPointerLeave?.(event)
        }}
        onPointerDown={(event) => {
          setExpanded(true)
          activate(event.currentTarget, event.pointerType === "touch", collapse)
          inspectionRef.current.triggerProps.onPointerDown?.(event)
        }}
        onClick={(event) => {
          setExpanded(true)
          activate(event.currentTarget, true, collapse)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            setExpanded(true)
            activate(event.currentTarget, true, collapse)
          }
          if (event.key === "Escape") setExpanded(false)
          inspectionRef.current.triggerProps.onKeyDown?.(event)
        }}
        onBlur={() => setExpanded(false)}
        className={cn(
          "relative grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-start gap-4 rounded-none border-0 bg-transparent px-4 py-3 text-left text-ink transition-colors duration-120 group-data-[context=true]/gem:pr-12 group-data-[leading=false]/gem:pl-10 group-data-[support=true]/gem:grid-cols-[40px_minmax(0,1fr)] hover:bg-skill-hover group-data-[support=true]/gem:hover:bg-support-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand aria-expanded:bg-skill-hover group-data-[support=true]/gem:aria-expanded:bg-support-hover @max-[600px]:grid-cols-[40px_minmax(0,1fr)] @max-[600px]:gap-x-3 @max-[600px]:gap-y-2 @max-[600px]:p-3 @max-[600px]:group-data-[leading=false]/gem:pl-7 @max-[600px]:group-data-[support=true]/gem:grid-cols-[34px_minmax(0,1fr)]",
          leading &&
            !gem.support &&
            "dither-fade isolate bg-skill-heading [--dither-opacity:0.11] before:mask-center [&_[data-slot=gem-name]>strong]:text-lg @max-[600px]:[&_[data-slot=gem-name]>strong]:text-gem-title"
        )}
        data-disabled={!gem.enabled}
        data-color={ref?.color}
        data-corrupted={gem.corrupted}
        aria-label={`${gem.name}. Show gem details`}
        aria-haspopup="dialog"
        aria-expanded={expanded}
      >
        <GemArt key={ref?.image} image={ref?.image} support={gem.support} />
        <span
          data-slot="gem-name"
          className="flex min-w-0 flex-col gap-1.5 [&_strong]:text-base [&_strong]:font-medium [&_strong]:wrap-anywhere @max-[600px]:[&_strong]:text-sm [&>span]:font-mono [&>span]:text-label [&>span]:text-ink-muted"
        >
          <strong>
            {gem.name}
            {main && (
              <Star
                className="ml-2 inline-block fill-brand/20 align-[-2px] text-brand"
                size={14}
                role="img"
                aria-label="Main skill group in PoB"
              />
            )}
            {gem.corrupted && (
              <Droplet
                className="ml-2 inline-block fill-negative/20 align-[-2px] text-negative"
                size={14}
                role="img"
                aria-label="Corrupted"
              />
            )}
          </strong>
          {!gem.enabled && <span>Disabled</span>}
          {tagRow}
        </span>
      </Button>
      {context.length > 0 && (
        <SkillSourceInfo name={gem.name} labels={context} />
      )}
    </li>
  )
})
export function SkillGems(
  props: ComponentProps<typeof SkillGemsContent> & TooltipPinOptions
) {
  return (
    <TooltipPinScope
      pinningEnabled={props.pinningEnabled}
      maxPinnedTooltips={props.maxPinnedTooltips ?? 1}
    >
      <SkillGemsContent {...props} />
    </TooltipPinScope>
  )
}
type ActiveGem = {
  gem: SavedGem
  main: boolean
  side: "left" | "right"
  anchor: HTMLElement
  hoverAnchor?: ReturnType<typeof pointerAnchor>
  collapse?: () => void
}

const SkillSections = memo(function SkillSections({
  groups,
  catalogue,
  inspectionRef,
  activate,
  moveHover,
}: {
  groups: ReturnType<typeof displaySkillGroups>
  catalogue?: GemCatalogue
  inspectionRef: { current: ReturnType<typeof useInspectionTooltip> }
  activate: (gem: ActiveGem, interactive?: boolean) => void
  moveHover: (anchor: HTMLElement, x: number, y: number) => void
}) {
  return [...groups]
    .sort((a, b) => Number(b.main) - Number(a.main))
    .map(({ skill, i, main, grants }, position) => {
      const labels = [
        ...skillGroupLabels(skill),
        ...grants.flatMap(skillGroupLabels),
      ]
      const supportOnly =
        skill.gems.length > 0 &&
        skill.gems.every(
          (gem) => findGem(catalogue, gem)?.support ?? gem.support
        )
      const mainIndex = skill.gems.findIndex(
        (gem) => !gem.support && gem.enabled
      )
      return (
        <section
          key={i}
          data-slot="build-skill"
          className="[container-type:inline-size] flow-root min-w-0 break-inside-avoid border border-rule-strong bg-surface data-[disabled=true]:opacity-55"
          data-disabled={!skill.enabled}
          data-support-only={supportOnly || undefined}
        >
          {supportOnly && (
            <div className="border-b border-rule-strong p-3">
              <p className="flex items-center gap-2 text-xs text-negative">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>There is no active skill in this group.</span>
              </p>
            </div>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {skill.gems.map((gem, j) => {
              const isMain = main && j === mainIndex
              return (
                <GemRow
                  key={`${j}-${gem.name}`}
                  gem={gem}
                  catalogue={catalogue}
                  inspectionRef={inspectionRef}
                  activate={(anchor, interactive, collapse, pointer) =>
                    activate(
                      {
                        gem,
                        main: isMain,
                        side: position % 2 === 0 ? "left" : "right",
                        anchor,
                        hoverAnchor: pointer
                          ? pointerAnchor(pointer.x, pointer.y)
                          : undefined,
                        collapse,
                      },
                      interactive
                    )
                  }
                  moveHover={moveHover}
                  context={j === 0 ? labels : undefined}
                  leading={j === 0}
                  main={isMain}
                />
              )
            })}
          </ul>
        </section>
      )
    })
})

function SkillGemsContent({
  skills,
  mainSocketGroup,
}: {
  skills: BuildSnapshot["skillSets"][number]["skills"]
  mainSocketGroup: number
}) {
  const catalogue = useGemCatalogue()
  const queryClient = useQueryClient()
  const inspection = useInspectionTooltip()
  const inspectionRef = useRef(inspection)
  inspectionRef.current = inspection
  const [active, setActive] = useState<ActiveGem>()
  const activate = useCallback((gem: ActiveGem, interactive = false) => {
    if (interactive) setActive(gem)
    else flushSync(() => setActive(gem))
    if (interactive) inspectionRef.current.openInteractive()
  }, [])
  const moveHover = useCallback((anchor: HTMLElement, x: number, y: number) => {
    setActive((current) => {
      if (!current || current.anchor !== anchor) return current
      const point = current.hoverAnchor?.getBoundingClientRect()
      if (point && Math.abs(point.x - x) < 48 && Math.abs(point.y - y) < 48)
        return current
      return { ...current, hoverAnchor: pointerAnchor(x, y) }
    })
  }, [])
  useEffect(() => {
    if (!inspection.open) active?.collapse?.()
  }, [inspection.open, active])
  const groups = useMemo(
    () => displaySkillGroups(skills, mainSocketGroup),
    [skills, mainSocketGroup]
  )
  const skillIds = useMemo(
    () => [
      ...new Set(
        groups.flatMap(({ skill }) =>
          skill.gems.flatMap((gem) => {
            const skillId = findGem(catalogue.data, gem)?.skillId
            return skillId ? [skillId] : []
          })
        )
      ),
    ],
    [groups, catalogue.data]
  )
  useEffect(() => {
    if (!skillIds.length) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      let next = 0
      const prefetch = async () => {
        while (!cancelled && next < skillIds.length) {
          const skillId = skillIds[next++]
          await queryClient.prefetchQuery(gemEffectsQueryOptions(skillId))
        }
      }
      void Promise.all(
        Array.from({ length: Math.min(3, skillIds.length) }, prefetch)
      )
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [queryClient, skillIds, groups])
  if (!groups.length)
    return <EmptyState frame="dashed">No skills saved in this set.</EmptyState>
  return (
    <>
      <div
        data-slot="build-skills"
        className="grid grid-cols-2 items-stretch gap-4 max-sm:grid-cols-1"
      >
        {catalogue.isError && (
          <Note className="col-span-full" role="status">
            Gem artwork and reference details could not be loaded. Saved values
            remain available.
          </Note>
        )}
        <SkillSections
          groups={groups}
          catalogue={catalogue.data}
          inspectionRef={inspectionRef}
          activate={activate}
          moveHover={moveHover}
        />
      </div>
      <Popover {...inspection.popoverProps}>
        {active && (
          <InspectionTooltipContent
            {...inspection.contentProps}
            pinLabel={`${active.gem.name} gem details`}
            className="[--inspection-width:330px] max-sm:[--inspection-padding:16px]"
            side={active.side}
            anchor={
              inspection.contentProps["data-hover-only"]
                ? (active.hoverAnchor ?? active.anchor)
                : active.anchor
            }
            align="start"
            sideOffset={14}
            collisionPadding={12}
            collisionAvoidance={{ side: "flip", align: "shift" }}
          >
            <GemTooltipContent
              gem={active.gem}
              catalogue={catalogue.data}
              main={active.main}
            />
          </InspectionTooltipContent>
        )}
      </Popover>
    </>
  )
}

function GemTags({
  reference,
  support,
  tooltip = false,
}: {
  reference?: GemReference
  support: boolean
  tooltip?: boolean
}) {
  const tags = [
    ...new Set(
      [
        reference?.type || (support ? "Support" : "Skill"),
        ...(reference?.tags.split(",") || []),
      ]
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ]
  return (
    <span
      data-slot="gem-tags"
      className={cn("flex min-w-0 flex-wrap gap-1.25", tooltip && "mt-3.5")}
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          className={cn(
            "rounded-tag wrap-anywhere in-data-[slot=gem-name]:border-rule-strong in-data-[slot=gem-name]:bg-transparent in-data-[slot=gem-name]:text-ink-muted",
            tooltip
              ? "px-1.75 py-0.75 text-label"
              : "px-1.25 py-0.5 text-micro",
            "leading-[1.4]"
          )}
        >
          {tag}
        </Badge>
      ))}
    </span>
  )
}

export function GemTooltipContent({
  gem,
  catalogue,
  main = false,
}: {
  gem: SavedGem
  catalogue?: GemCatalogue
  main?: boolean
}) {
  const ref = findGem(catalogue, gem)
  const tagRow = <GemTags reference={ref} support={gem.support} tooltip />
  const effects = useQuery({
    ...gemEffectsQueryOptions(ref?.skillId ?? ""),
    enabled: !!ref?.skillId,
  })
  const values = gemEffectValues(effects.data, gem)
  const header = ref?.gameId ? catalogue?.headers?.gems[ref.gameId] : undefined
  const levelData = ref?.skillId
    ? catalogue?.headers?.skills[ref.skillId]?.[String(values.level)]
    : undefined
  const attributeRequirement = (level: number | undefined, weight: number) =>
    level === undefined
      ? undefined
      : Math.round((5 + (level - 3) * 1.7) * (weight / 100) ** 0.9) + 4
  const requiredLevel = levelData?.levelRequirement
  const requirements = [
    !gem.support && requiredLevel !== undefined
      ? `Level ${Math.max(1, requiredLevel)}`
      : "",
    ...(
      [
        ["strength", "Str"],
        ["dexterity", "Dex"],
        ["intelligence", "Int"],
      ] as const
    ).map(([attribute, label]) => {
      const weight = header?.[attribute] ?? 0
      if (gem.support || !weight || requiredLevel === undefined) return ""
      return `${attributeRequirement(requiredLevel, weight)} ${label}`
    }),
    header?.weapon ?? "",
  ].filter(Boolean)
  const costs = Object.entries(levelData?.cost ?? {}).map(
    ([resource, amount]) => `${amount} ${resource}`
  )
  const showQuality = !gem.quality || Number(gem.quality) !== 0
  const showCorruptLevel =
    gem.corrupted && gem.corruptLevel && gem.corruptLevel !== "0"
  const showProperties =
    !gem.support ||
    showQuality ||
    showCorruptLevel ||
    ref?.castTime !== undefined ||
    !!header?.tier ||
    !!levelData ||
    requirements.length > 0
  return (
    <>
      <div data-slot="gem-tooltip-heading" className="flex items-start gap-3">
        <GemArt
          key={ref?.image}
          image={ref?.image}
          support={gem.support}
          tooltip
        />
        <div className="min-w-0 flex-1 [&_p]:mt-1.5 [&_p]:flex [&_p]:items-center [&_p]:gap-1.5 [&_p]:font-mono [&_p]:text-label [&_p]:leading-[1.6]">
          <PopoverTitle>{gem.name}</PopoverTitle>
          {gem.corrupted && (
            <p data-slot="gem-corrupted" className="text-negative">
              <Droplet size={14} aria-hidden="true" />
              Corrupted
            </p>
          )}
          {main && (
            <p className="text-brand">
              <Star size={14} aria-hidden="true" />
              Main skill group in PoB
            </p>
          )}
        </div>
      </div>
      {tagRow}
      {showProperties && (
        <dl
          data-slot="gem-properties"
          className="my-4 border-y border-rule-strong py-3 [&_[data-corrupted=true]]:text-negative [&_dd]:m-0 [&_dd]:text-right [&_dd]:font-mono [&_dt]:text-ink-muted [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:py-0.75 [&>div]:text-xs"
        >
          {!gem.support && (
            <div>
              <dt>Gem level</dt>
              <dd>{gem.level || "Not saved"}</dd>
            </div>
          )}
          {!!header?.tier && (
            <div>
              <dt>Tier</dt>
              <dd>{header.tier}</dd>
            </div>
          )}
          {showQuality && (
            <div>
              <dt>Quality</dt>
              <dd>{gem.quality ? `${gem.quality}%` : "Not saved"}</dd>
            </div>
          )}
          {showCorruptLevel && (
            <div>
              <dt>Corruption level modifier</dt>
              <dd>
                {Number(gem.corruptLevel) > 0 ? "+" : ""}
                {gem.corruptLevel}
              </dd>
            </div>
          )}
          {costs.length > 0 && (
            <div>
              <dt>Cost</dt>
              <dd>{costs.join(", ")}</dd>
            </div>
          )}
          {levelData?.manaMultiplier !== undefined && (
            <div>
              <dt>Mana multiplier</dt>
              <dd>{100 + levelData.manaMultiplier}%</dd>
            </div>
          )}
          {levelData?.attackSpeedMultiplier !== undefined && (
            <div>
              <dt>Attack speed</dt>
              <dd>{100 + levelData.attackSpeedMultiplier}% of base</dd>
            </div>
          )}
          {levelData?.baseMultiplier !== undefined &&
            ref?.type === "Attack" && (
              <div>
                <dt>Attack damage</dt>
                <dd>{Math.round(levelData.baseMultiplier * 100)}% of base</dd>
              </div>
            )}
          {levelData?.critChance !== undefined && (
            <div>
              <dt>Critical hit chance</dt>
              <dd>{levelData.critChance}%</dd>
            </div>
          )}
          {ref?.castTime !== undefined && ref.type !== "Attack" && (
            <div>
              <dt>Base cast time</dt>
              <dd>{ref.castTime}s</dd>
            </div>
          )}
          {requirements.length > 0 && (
            <div>
              <dt>Requires</dt>
              <dd>{requirements.join(", ")}</dd>
            </div>
          )}
        </dl>
      )}
      <PopoverDescription
        data-slot="gem-description"
        className={cn("m-0 text-2xs leading-[1.65]", !showProperties && "mt-4")}
      >
        {ref?.description ||
          "Reference details are unavailable for this gem. Saved gem values are shown above."}
      </PopoverDescription>
      <div
        className="mt-4 border-t border-rule-strong pt-3.5"
        aria-label="Gem effects"
      >
        {values.base ? (
          <>
            <p
              data-slot="gem-effect-label"
              className="mb-2.5 font-mono text-label leading-[1.6] text-ink-muted"
            >
              {values.label || gem.name}
              {!gem.support && ` · Level ${values.level}`}
            </p>
            {values.base.lines.length > 0 && (
              <EffectList
                data-slot="gem-effect-lines"
                hideSingleMarker
                className="text-item-magic [&>li]:text-xs [&>li]:leading-[1.45]! [&>li+li]:mt-0.75"
              >
                {values.base.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </EffectList>
            )}
            {values.quality && values.quality.lines.length > 0 && (
              <>
                <p
                  data-slot="gem-effect-label"
                  className="mt-3.5 mb-2.5 font-mono text-label leading-[1.6] text-ink-muted"
                >
                  From {gem.quality}% quality
                </p>
                <EffectList
                  hideSingleMarker
                  className="text-item-magic [&>li]:text-xs [&>li]:leading-[1.45]! [&>li+li]:mt-0.75"
                >
                  {values.quality.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </EffectList>
              </>
            )}
            {(values.base.partial ||
              values.quality?.partial ||
              values.missingQuality) && (
              <p className="mt-3.5 mb-2.5 font-mono text-label leading-[1.6] text-ink-muted">
                Some values require additional context or are unavailable in
                this reference.
              </p>
            )}
            {!values.base.lines.length && !values.base.partial && (
              <p className="mt-3.5 mb-2.5 font-mono text-label leading-[1.6] text-ink-muted">
                No additional effect lines in this reference.
              </p>
            )}
          </>
        ) : (
          <p
            className="mb-2.5 font-mono text-label leading-[1.6] text-ink-muted"
            role="status"
          >
            {effects.isFetching
              ? "Loading gem effects…"
              : "Numerical effects are unavailable for this gem or saved level."}
          </p>
        )}
      </div>
      {!gem.enabled && (
        <p className="mt-4 font-mono text-label leading-[1.6] text-ink-muted">
          Disabled in this skill group.
        </p>
      )}
    </>
  )
}
