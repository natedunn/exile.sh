import { useGemCatalogue } from "../lib/use-gem-catalogue"
import { useInspectionTooltip } from "./use-inspection-tooltip"
import { InspectionTooltipContent, TooltipPinScope } from "./tooltip-pins"
import type { TooltipPinOptions } from "./tooltip-pins"
import type { ComponentProps } from "react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Diamond, Droplet, Info, Star, TriangleAlert } from "lucide-react"
import {
  findGem,
  gemEffectValues,
  skillGroupLabels,
  displaySkillGroups,
} from "../../shared/gems"
import type {
  GemCatalogue,
  GemReference,
  SavedGem,
  GemEffects,
} from "../../shared/gems"
import type { BuildSnapshot } from "../../shared/pob"
import { Button } from "./ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from "./ui/popover"

export function GemReferenceInfo() {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label="About gem data"
      >
        <Info aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className="gem-reference-info"
        side="top"
        collisionPadding={12}
      >
        <PopoverTitle>Gem data</PopoverTitle>
        <PopoverDescription>
          Gem reference: PoE 2 0.5. Base information; build modifiers are not
          applied.
        </PopoverDescription>
        <a href="/methodology">Data & attribution</a>
      </PopoverContent>
    </Popover>
  )
}

function SkillSourceInfo({ name, labels }: { name: string; labels: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-lg" />}
        className="skill-source-trigger"
        aria-label={`${name}. Show skill source`}
        delay={0}
        closeOnClick={false}
        onClick={() => setOpen(true)}
      >
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent className="skill-source-tooltip" side="top" align="end">
        <h3>Skill source</h3>
        <div>
          {labels.map((label, index) => (
            <p key={index}>{label}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function GemArt({ image, support }: { image?: string; support: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="skill-gem-art" data-support={support}>
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
function GemRow({
  gem,
  catalogue,
  main = false,
  side = "right",
  context = [],
}: {
  gem: SavedGem
  catalogue?: GemCatalogue
  /** Which way the card opens, away from the neighbouring column. */
  side?: "left" | "right"
  main?: boolean
  context?: string[]
}) {
  const ref = findGem(catalogue, gem)
  const tagRow = <GemTags reference={ref} support={gem.support} />
  const inspection = useInspectionTooltip()
  return (
    <li
      className="skill-gem-entry"
      data-support={gem.support}
      data-context={context.length > 0 || undefined}
    >
      <Popover {...inspection.popoverProps}>
        <PopoverTrigger
          {...inspection.triggerProps}
          className="skill-gem-row"
          data-disabled={!gem.enabled}
          data-color={ref?.color}
          data-corrupted={gem.corrupted}
          aria-label={`${gem.name}. Show gem details`}
        >
          <GemArt key={ref?.image} image={ref?.image} support={gem.support} />
          <span className="skill-gem-name">
            <strong>
              {gem.name}
              {main && (
                <Star
                  className="skill-gem-main-icon"
                  size={14}
                  role="img"
                  aria-label="Main skill group in PoB"
                />
              )}
              {gem.corrupted && (
                <Droplet
                  className="skill-gem-corrupted-icon"
                  size={14}
                  role="img"
                  aria-label="Corrupted"
                />
              )}
            </strong>
            {!gem.enabled && <span>Disabled</span>}
            {tagRow}
          </span>
        </PopoverTrigger>
        <InspectionTooltipContent
          {...inspection.contentProps}
          showPin={inspection.contentProps.showPin}
          pinLabel={`${gem.name} gem details`}
          className="skill-gem-tooltip"
          side={side}
          align="start"
          sideOffset={14}
          collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift" }}
        >
          <GemTooltipContent gem={gem} catalogue={catalogue} main={main} />
        </InspectionTooltipContent>
      </Popover>
      {context.length > 0 && (
        <SkillSourceInfo name={gem.name} labels={context} />
      )}
    </li>
  )
}
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
function SkillGemsContent({
  skills,
  mainSocketGroup,
}: {
  skills: BuildSnapshot["skillSets"][number]["skills"]
  mainSocketGroup: number
}) {
  const catalogue = useGemCatalogue()
  const groups = displaySkillGroups(skills, mainSocketGroup)
  if (!groups.length)
    return <p className="build-empty">No skills saved in this set.</p>
  return (
    <div className="build-skills">
      {catalogue.isError && (
        <p className="build-muted" role="status">
          Gem artwork and reference details could not be loaded. Saved values
          remain available.
        </p>
      )}
      {groups
        .sort((a, b) => Number(b.main) - Number(a.main))
        .map(({ skill, i, main, grants }, position) => {
          const labels = [
            ...skillGroupLabels(skill),
            ...grants.flatMap(skillGroupLabels),
          ]
          const supportOnly =
            skill.gems.length > 0 &&
            skill.gems.every(
              (gem) => findGem(catalogue.data, gem)?.support ?? gem.support
            )
          return (
            <section
              key={i}
              className="build-skill"
              data-disabled={!skill.enabled}
              data-support-only={supportOnly || undefined}
            >
              {supportOnly && (
                <div className="build-skill-context">
                  <p className="build-skill-warning">
                    <TriangleAlert size={16} aria-hidden="true" />
                    <span>There is no active skill in this group.</span>
                  </p>
                </div>
              )}
              <ul className="skill-gem-list">
                {skill.gems.map((gem, j) => (
                  <GemRow
                    key={`${j}-${gem.name}`}
                    gem={gem}
                    catalogue={catalogue.data}
                    context={j === 0 ? labels : undefined}
                    main={
                      main &&
                      j === skill.gems.findIndex((g) => !g.support && g.enabled)
                    }
                    side={position % 2 === 0 ? "left" : "right"}
                  />
                ))}
              </ul>
            </section>
          )
        })}
    </div>
  )
}

function GemTags({
  reference,
  support,
}: {
  reference?: GemReference
  support: boolean
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
    <span className="skill-gem-tags">
      {tags.map((tag) => (
        <span key={tag} className="skill-gem-tag">
          {tag}
        </span>
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
  const tagRow = <GemTags reference={ref} support={gem.support} />
  const effects = useQuery<GemEffects>({
    queryKey: ["gem-effects", "v1", ref?.skillId],
    enabled: !!ref?.skillId,
    queryFn: async () => {
      const response = await fetch(
        `/gems/effects-v1/${encodeURIComponent(ref!.skillId)}.json`
      )
      if (!response.ok) throw new Error("Gem effects unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  })
  const values = gemEffectValues(effects.data, gem)
  return (
    <>
      <div className="skill-gem-tooltip-heading">
        <GemArt key={ref?.image} image={ref?.image} support={gem.support} />
        <div>
          <PopoverTitle>{gem.name}</PopoverTitle>
          {gem.corrupted && (
            <p className="skill-gem-corrupted-label">
              <Droplet size={14} aria-hidden="true" />
              Corrupted
            </p>
          )}
          {main && (
            <p className="skill-gem-main-label">
              <Star size={14} aria-hidden="true" />
              Main skill group in PoB
            </p>
          )}
        </div>
      </div>
      {tagRow}
      <dl className="skill-gem-properties">
        <div>
          <dt>Gem level</dt>
          <dd>{gem.level || "Not saved"}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{gem.quality ? `${gem.quality}%` : "Not saved"}</dd>
        </div>
        {!gem.corrupted && (
          <div>
            <dt>Corruption</dt>
            <dd data-corrupted={gem.corrupted}>
              {gem.corrupted === false ? "Uncorrupted" : "Not saved"}
            </dd>
          </div>
        )}
        {gem.corrupted && gem.corruptLevel && gem.corruptLevel !== "0" && (
          <div>
            <dt>Corruption level modifier</dt>
            <dd>
              {Number(gem.corruptLevel) > 0 ? "+" : ""}
              {gem.corruptLevel}
            </dd>
          </div>
        )}
        {ref?.castTime !== undefined && (
          <div>
            <dt>Base cast time</dt>
            <dd>{ref.castTime}s</dd>
          </div>
        )}
      </dl>
      <PopoverDescription className="skill-gem-description">
        {ref?.description ||
          "Reference details are unavailable for this gem. Saved gem values are shown above."}
      </PopoverDescription>
      <div className="skill-gem-effects" aria-label="Gem effects">
        {values.base ? (
          <>
            <p className="skill-gem-effect-label">
              {values.label || gem.name} · Level {values.level}
            </p>
            {values.base.lines.length > 0 && (
              <ul className="tree-lines">
                {values.base.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
            {values.quality && values.quality.lines.length > 0 && (
              <>
                <p className="skill-gem-effect-label">
                  From {gem.quality}% quality
                </p>
                <ul className="tree-lines">
                  {values.quality.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            {(values.base.partial ||
              values.quality?.partial ||
              values.missingQuality) && (
              <p className="skill-gem-effect-status">
                Some values require additional context or are unavailable in
                this reference.
              </p>
            )}
            {!values.base.lines.length && !values.base.partial && (
              <p className="skill-gem-effect-status">
                No additional effect lines in this reference.
              </p>
            )}
          </>
        ) : (
          <p className="skill-gem-effect-status" role="status">
            {effects.isFetching
              ? "Loading gem effects…"
              : "Numerical effects are unavailable for this gem or saved level."}
          </p>
        )}
      </div>
      {!gem.enabled && (
        <p className="skill-gem-disabled">Disabled in this skill group.</p>
      )}
    </>
  )
}
