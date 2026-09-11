import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Diamond, Droplet, Info, Star, X } from "lucide-react"
import { findGem, gemEffectValues } from "../../shared/gems"
import type { GemCatalogue, SavedGem, GemEffects } from "../../shared/gems"
import type { BuildSnapshot } from "../../shared/pob"
import { Button } from "./ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
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
}: {
  gem: SavedGem
  catalogue?: GemCatalogue
  main?: boolean
}) {
  const ref = findGem(catalogue, gem)
  const tags = [
    ...new Set(
      [
        ref?.type || (gem.support ? "Support" : "Skill"),
        ...(ref?.tags.split(",") || []),
      ]
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ]
  const tagRow = (
    <span className="skill-gem-tags">
      {tags.map((tag) => (
        <span key={tag} className="skill-gem-tag">
          {tag}
        </span>
      ))}
    </span>
  )
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)
  const [hoverOnly, setHoverOnly] = useState(false)
  const hovering = useRef(false)
  const holding = useRef(false)
  useEffect(() => {
    if (!open) return
    const release = () => {
      holding.current = false
      setHeld(false)
      if (hoverOnly && !hovering.current) setOpen(false)
    }
    const down = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        holding.current = true
        setHeld(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") release()
    }
    const blur = () => {
      release()
      setOpen(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      holding.current = false
    }
  }, [open, hoverOnly])
  const effects = useQuery<GemEffects>({
    queryKey: ["gem-effects", "v1", ref?.skillId],
    enabled: open && !!ref?.skillId,
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
    <li className="skill-gem-entry" data-support={gem.support}>
      <Popover
        open={open}
        onOpenChange={(next, details) => {
          if (
            details.reason === "trigger-press" &&
            hoverOnly &&
            hovering.current
          ) {
            setOpen(true)
            return
          }
          setOpen(next)
          if (!next) setHeld(false)
        }}
      >
        <PopoverTrigger
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") return
            hovering.current = true
            if (event.altKey) return
            setHoverOnly(true)
            setHeld(false)
            setOpen(true)
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return
            hovering.current = false
            if (!holding.current) setOpen(false)
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") setHoverOnly(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setHoverOnly(false)
          }}
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
          <span className="skill-gem-number">
            <span>Level</span>
            <strong>{gem.level || "—"}</strong>
          </span>
          <span className="skill-gem-number">
            <span>Quality</span>
            <strong>{gem.quality ? `${gem.quality}%` : "—"}</strong>
          </span>
        </PopoverTrigger>
        <PopoverContent
          className="skill-gem-tooltip"
          data-hover-only={hoverOnly && !held}
          positionerClassName={
            hoverOnly && !held ? "skill-gem-hover-positioner" : undefined
          }
          side="top"
          sideOffset={10}
          collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift" }}
        >
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
            <PopoverClose
              className="skill-gem-close"
              aria-label="Close gem details"
            >
              <X size={16} />
            </PopoverClose>
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
        </PopoverContent>
      </Popover>
    </li>
  )
}
export function SkillGems({
  skills,
  mainSocketGroup,
}: {
  skills: BuildSnapshot["skillSets"][number]["skills"]
  mainSocketGroup: number
}) {
  const catalogue = useQuery<GemCatalogue>({
    queryKey: ["gem-reference", "v1"],
    queryFn: async () => {
      const response = await fetch("/gems/v1/catalogue.json")
      if (!response.ok) throw new Error("Gem reference unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
  if (!skills.length)
    return <p className="build-empty">No skills saved in this set.</p>
  return (
    <div className="build-skills">
      {catalogue.isError && (
        <p className="build-muted" role="status">
          Gem artwork and reference details could not be loaded. Saved values
          remain available.
        </p>
      )}
      {skills
        .map((skill, i) => ({ skill, i }))
        .sort(
          (a, b) =>
            Number(b.i === mainSocketGroup - 1) -
            Number(a.i === mainSocketGroup - 1)
        )
        .map(({ skill, i }) => (
          <section
            key={i}
            className="build-skill"
            data-disabled={!skill.enabled}
          >
            {!skill.enabled && (
              <div className="build-skill-title">
                <span>Disabled</span>
              </div>
            )}
            <ul className="skill-gem-list">
              {skill.gems.map((gem, j) => (
                <GemRow
                  key={`${j}-${gem.name}`}
                  gem={gem}
                  catalogue={catalogue.data}
                  main={
                    i === mainSocketGroup - 1 &&
                    j === skill.gems.findIndex((g) => !g.support && g.enabled)
                  }
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
