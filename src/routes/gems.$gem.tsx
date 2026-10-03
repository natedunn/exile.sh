import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Fragment, useState } from "react"
import { Check, Copy, Square, Star } from "lucide-react"
import { z } from "zod"
import type { GemReference, SavedGem } from "../../shared/gems"
import { gemEffectValues } from "../../shared/gems"
import { CompatibleGems } from "../components/compatible-gems"
import { EffectList } from "../components/effect-list"
import { GemSection, GemSectionTitle } from "../components/gem-section"
import {
  GemKeywordProvider,
  GemKeywordText,
} from "../components/gem-keyword-text"
import {
  effectIncreaseParts,
  effectRangeLine,
  gemTags,
} from "../lib/gem-display"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { EmptyState } from "../components/ui/empty-state"
import {
  StatsBody,
  StatsHeading,
  StatsList,
  StatsRow,
  StatsSection,
} from "../components/build/stats-ledger"
import { Field, FieldLabel } from "../components/ui/field"
import { NumberStepper } from "../components/ui/number-stepper"
import { Toggle } from "../components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"
import {
  PageHeading,
  PageHeadingCopy,
  PageTitle,
} from "../components/ui/page-heading"
import { gemEffectsQueryOptions } from "../lib/gem-effects"
import { getGemPage } from "../lib/gem-page"
import { shareMeta } from "../lib/share-meta"
import { useGemFavorites } from "../lib/use-saved-list"
import { defaultGemSearch } from "./gems"

export const Route = createFileRoute("/gems/$gem")({
  validateSearch: (search) => ({
    gemLevel: z.coerce
      .number()
      .int()
      .min(1)
      .max(40)
      .optional()
      .catch(undefined)
      .parse(search.gemLevel),
    gemQuality: z.coerce
      .number()
      .int()
      .min(1)
      .max(62)
      .optional()
      .catch(undefined)
      .parse(search.gemQuality),
    advancedQuality: z.coerce
      .number()
      .int()
      .min(1)
      .max(1)
      .optional()
      .catch(undefined)
      .parse(search.advancedQuality),
  }),
  loader: async ({ params }) => {
    const page = await getGemPage({ data: { slug: params.gem } })
    if (!page) throw notFound()
    return page
  },
  staleTime: Infinity,
  notFoundComponent: () => (
    <EmptyState frame="dashed" className="my-8">
      <h1 className="display text-section text-ink">Gem not found.</h1>
      <Link
        to="/gems"
        search={defaultGemSearch}
        className="text-brand underline"
      >
        Browse gems
      </Link>
    </EmptyState>
  ),
  head: ({ loaderData }) =>
    loaderData
      ? shareMeta({
          title: `${loaderData.name} — PoE2 ${loaderData.support ? "Support" : "Skill"} Gem`,
          description:
            loaderData.description ||
            `${loaderData.name}, a Path of Exile 2 ${loaderData.support ? "support" : "skill"} gem: effects, requirements and compatible gems.`,
          path: `/gems/${loaderData.slug}`,
          image: `/og/gems/${loaderData.slug}`,
        })
      : { meta: [{ title: "Gem details · exile.sh" }] },
  component: GemDetailPage,
})

function makeGem(
  reference: GemReference,
  level: number,
  quality: number
): SavedGem {
  return {
    name: reference.name,
    gemId: reference.gameId,
    skillId: reference.skillId,
    variantId: reference.variantId,
    level: String(reference.support ? 1 : level),
    quality: String(quality),
    corrupted: false,
    enabled: true,
    support: reference.support,
  }
}

function change(
  before: number | undefined,
  after: number | undefined,
  unit = "",
  deltaUnit = unit
) {
  if (before === undefined || after === undefined || before === after)
    return null
  const difference = Math.round((after - before) * 100) / 100
  return `${difference > 0 ? "+" : ""}${difference}${deltaUnit}`
}

const toneClass = {
  red: "text-tone-red",
  green: "text-tone-green",
  blue: "text-tone-blue",
}

function attributeRequirement(level: number | undefined, weight: number) {
  return level === undefined
    ? undefined
    : Math.round((5 + (level - 3) * 1.7) * (weight / 100) ** 0.9) + 4
}

function GemLevelDelta({
  text,
  slot,
}: {
  text: string
  slot: "gem-effect-increase" | "gem-property-delta"
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        data-slot={slot}
        className="cursor-pointer text-brand underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>
        This change comes from the selected gem level, compared with level 1.
      </TooltipContent>
    </Tooltip>
  )
}

function GemDetailPage() {
  const page = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  )
  const listSearch = {
    q: search.q,
    level: search.level,
    quality: search.quality,
    page: search.page,
  }
  const reference = page.reference
  const { favorites, toggleFavorite } = useGemFavorites()
  const favorite = favorites.includes(reference.gameId)
  const skillId = reference.skillId
  const effects = useQuery({
    ...gemEffectsQueryOptions(skillId),
    initialData: page.effects ?? undefined,
    enabled: page.effects !== null,
  })
  // An absent parameter is the natural range. Typing or stepping selects one value.
  const level = reference.support ? null : (search.gemLevel ?? null)
  const quality = reference.support ? null : (search.gemQuality ?? null)
  const setLevel = (value: number | null) => {
    setCopyState("idle")
    void navigate({
      search: (previous) => ({ ...previous, gemLevel: value ?? undefined }),
      replace: true,
      resetScroll: false,
    })
  }
  const setQuality = (value: number | null) => {
    setCopyState("idle")
    void navigate({
      search: (previous) => ({ ...previous, gemQuality: value ?? undefined }),
      replace: true,
      resetScroll: false,
    })
  }
  const setAdvancedQuality = (checked: boolean) => {
    setCopyState("idle")
    void navigate({
      search: (previous) => ({
        ...previous,
        advancedQuality: checked ? 1 : undefined,
      }),
      replace: true,
      resetScroll: false,
    })
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyState("copied")
    } catch {
      setCopyState("error")
    }
  }
  const header = page.header
  const rangeEnd = reference.support
    ? 1
    : Math.min(20, header?.naturalMaxLevel ?? 20)
  const startGem = makeGem(reference, 1, 0)
  const endGem = makeGem(reference, rangeEnd, 20)
  const firstQualityGem = makeGem(reference, level ?? 1, 1)
  const lastQualityGem = makeGem(reference, level ?? 1, 20)
  const currentGem = makeGem(reference, level ?? 1, quality ?? 0)
  const firstLevel = page.levels["1"]
  const lastLevel = page.levels[String(rangeEnd)]
  const currentLevel = page.levels[String(level ?? 1)]
  const selectedLevel = level === null ? firstLevel : currentLevel
  const tags = gemTags(reference)

  const rangeValue = (start: number | undefined, end: number | undefined) =>
    start === undefined
      ? ""
      : level === null && end !== undefined && start !== end
        ? `${start}–${end}`
        : String(level === null ? start : (end ?? start))
  type StatRow = {
    label: string
    value: string
    delta?: string | null
    tone?: "red" | "green" | "blue"
  }
  const propertyRows: StatRow[] = []
  // One requirement per row keeps each level change readable.
  const requirementRows: StatRow[] = []
  if (header?.tier)
    propertyRows.push({ label: "Tier", value: String(header.tier) })
  if (!reference.support && firstLevel?.cost) {
    const resources = Object.entries(firstLevel.cost)
    const cost = resources.map(([resource, amount]) => {
      const selected = selectedLevel?.cost?.[resource]
      return `${rangeValue(amount, level === null ? lastLevel?.cost?.[resource] : selected)} ${resource}`
    })
    const delta = resources
      .map(([resource, amount]) =>
        change(
          amount,
          selectedLevel?.cost?.[resource],
          resources.length > 1 ? ` ${resource}` : ""
        )
      )
      .filter(Boolean)
      .join(", ")
    propertyRows.push({
      label: "Cost",
      value: cost.join(", "),
      delta: level === null ? null : delta,
    })
  }
  if (selectedLevel?.manaMultiplier !== undefined) {
    const start =
      100 + (firstLevel?.manaMultiplier ?? selectedLevel.manaMultiplier)
    const selected = 100 + selectedLevel.manaMultiplier
    const end =
      lastLevel?.manaMultiplier === undefined
        ? undefined
        : 100 + lastLevel.manaMultiplier
    propertyRows.push({
      label: "Mana multiplier",
      value: `${rangeValue(start, level === null ? end : selected)}%`,
      delta: level === null ? null : change(start, selected, "%", " pp"),
    })
  }
  if (firstLevel?.attackSpeedMultiplier !== undefined) {
    const start = 100 + firstLevel.attackSpeedMultiplier
    const selected =
      selectedLevel?.attackSpeedMultiplier === undefined
        ? undefined
        : 100 + selectedLevel.attackSpeedMultiplier
    const end =
      lastLevel?.attackSpeedMultiplier === undefined
        ? undefined
        : 100 + lastLevel.attackSpeedMultiplier
    propertyRows.push({
      label: "Attack speed",
      value: `${rangeValue(start, level === null ? end : selected)}% of base`,
      delta: level === null ? null : change(start, selected, "%"),
    })
  }
  if (reference.type === "Attack" && firstLevel?.baseMultiplier !== undefined) {
    const start = Math.round(firstLevel.baseMultiplier * 100)
    const selected =
      selectedLevel?.baseMultiplier === undefined
        ? undefined
        : Math.round(selectedLevel.baseMultiplier * 100)
    const end =
      lastLevel?.baseMultiplier === undefined
        ? undefined
        : Math.round(lastLevel.baseMultiplier * 100)
    propertyRows.push({
      label: "Attack damage",
      value: `${rangeValue(start, level === null ? end : selected)}% of base`,
      delta: level === null ? null : change(start, selected, "%"),
    })
  }
  if (firstLevel?.critChance !== undefined)
    propertyRows.push({
      label: "Critical hit chance",
      value: `${rangeValue(firstLevel.critChance, level === null ? lastLevel?.critChance : selectedLevel?.critChance)}%`,
      delta:
        level === null
          ? null
          : change(
              firstLevel.critChance,
              selectedLevel?.critChance,
              "%",
              " pp"
            ),
    })
  if (reference.castTime !== undefined && reference.type !== "Attack")
    propertyRows.push({
      label: "Base cast time",
      value: `${reference.castTime}s`,
    })
  if (!reference.support && firstLevel?.levelRequirement !== undefined) {
    const start = Math.max(1, firstLevel.levelRequirement)
    const selected = selectedLevel?.levelRequirement
    requirementRows.push({
      label: "Level",
      value: rangeValue(
        start,
        level === null ? lastLevel?.levelRequirement : selected
      ),
      delta: level === null ? null : change(start, selected),
    })
    for (const [attribute, label, tone] of [
      ["strength", "Strength", "red"],
      ["dexterity", "Dexterity", "green"],
      ["intelligence", "Intelligence", "blue"],
    ] as const) {
      const weight = header?.[attribute] ?? 0
      if (!weight) continue
      const first = attributeRequirement(firstLevel.levelRequirement, weight)
      const end = attributeRequirement(
        level === null ? lastLevel?.levelRequirement : selected,
        weight
      )
      requirementRows.push({
        label,
        value: rangeValue(first, end),
        delta: level === null ? null : change(first, end),
        tone,
      })
    }
  }
  if (header?.weapon)
    requirementRows.push({ label: "Weapon", value: header.weapon })

  const effectSets = Object.entries(effects.data?.sets ?? {})
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([id, set]) => {
      const forSet = (gem: SavedGem) =>
        gemEffectValues(effects.data, { ...gem, statSetIndex: id })
      const first = forSet(startGem)
      const last = forSet(endGem)
      const firstQuality = forSet(firstQualityGem)
      const lastQuality = forSet(lastQualityGem)
      const current = forSet(currentGem)
      const beforeLines = first.base?.lines ?? []
      const afterLines = current.base?.lines ?? []
      return {
        id,
        label: set.label || reference.name || "Effects",
        baselineLines: beforeLines,
        lines:
          level === null && first.base && last.base
            ? [
                ...first.base.lines.map((line, index) =>
                  last.base?.lines[index]
                    ? effectRangeLine(line, last.base.lines[index])
                    : line
                ),
                ...last.base.lines
                  .slice(first.base.lines.length)
                  .map((line) => `At level ${rangeEnd}: ${line}`),
              ]
            : afterLines,
        qualityLines:
          quality === null
            ? (lastQuality.quality?.lines.map((line, index) =>
                firstQuality.quality?.lines[index]
                  ? effectRangeLine(firstQuality.quality.lines[index], line)
                  : line
              ) ?? [])
            : (current.quality?.lines ?? []),
        gemlingQualityLines:
          quality === null
            ? (lastQuality.gemlingQuality?.lines.map((line, index) =>
                firstQuality.gemlingQuality?.lines[index]
                  ? effectRangeLine(
                      firstQuality.gemlingQuality.lines[index],
                      line
                    )
                  : line
              ) ?? [])
            : (current.gemlingQuality?.lines ?? []),
        partial: !!(
          current.base?.partial ||
          current.quality?.partial ||
          current.gemlingQuality?.partial
        ),
      }
    })
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] pt-12 max-lg:flex-wrap">
        <Link
          to="/gems"
          search={listSearch}
          className="absolute top-4 left-[var(--shell-gutter)] z-2 mono-label text-ink-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← All gems
        </Link>
        <PageHeadingCopy className="max-w-3xl">
          <PageTitle>{page.name}</PageTitle>
          {tags.length > 0 && (
            <div data-slot="gem-header-tags" className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="brand" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </PageHeadingCopy>
        {/* Gem art cannot be pre-baked, so one dithered radial mask thins the
          art and dot screen out toward every edge of the heading. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden [mask-image:var(--dither-glow-masthead)] [mask-size:100%_100%] [mask-repeat:no-repeat] opacity-70 max-sm:w-2/3 max-sm:opacity-35"
        >
          {skillId === "LightningArrowPlayer" ? (
            <img
              src="/art/lightning-arrow-hover.webp"
              alt=""
              width="699"
              height="369"
              className="size-full object-cover object-top"
            />
          ) : reference.image && !reference.support ? (
            <img
              src={reference.image}
              alt=""
              className="absolute top-0 left-[68%] aspect-square h-full -translate-x-1/2 [mask-image:radial-gradient(closest-side,black_45%,transparent)] brightness-125 contrast-125 grayscale saturate-200 sepia [image-rendering:pixelated]"
            />
          ) : null}
          <div className="absolute inset-0 dot-screen text-brand/15" />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-pressed={favorite}
          className="relative z-1 ml-auto shrink-0 bg-paper aria-pressed:border-brand-deep aria-pressed:bg-notice aria-pressed:text-brand"
          onClick={() => toggleFavorite(reference.gameId)}
        >
          <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
          {favorite ? "Favorited" : "Favorite"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="relative z-1 shrink-0 bg-paper"
          onClick={() => void copyLink()}
        >
          <Copy aria-hidden="true" />
          {copyState === "copied"
            ? "Copied"
            : copyState === "error"
              ? "Couldn’t copy link"
              : "Copy link"}
        </Button>
      </PageHeading>
      <GemKeywordProvider>
        <div className="-mx-[var(--shell-gutter)] grid min-w-0 flex-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 lg:border-r lg:border-rule-strong">
            <GemSection
              aria-labelledby="gem-description-title"
              className="border-b-0 pb-0"
            >
              <GemSectionTitle id="gem-description-title">
                Description
              </GemSectionTitle>
              <TooltipProvider delay={0}>
                <p
                  data-slot="gem-description"
                  className="mt-2 px-[var(--shell-gutter)] font-display text-xl leading-relaxed text-ink-soft"
                >
                  <GemKeywordText
                    sourceSkillId={skillId}
                    text={
                      reference.description ||
                      "Reference details are unavailable for this gem."
                    }
                  />
                </p>
              </TooltipProvider>
            </GemSection>
            <GemSection
              aria-labelledby="gem-effects-title"
              className="px-[var(--shell-gutter)]"
            >
              <GemSectionTitle id="gem-effects-title" className="px-0">
                Effects
              </GemSectionTitle>
              <TooltipProvider delay={0}>
                {effectSets.length > 0 ? (
                  effectSets.map((set) => (
                    <div
                      key={set.id}
                      data-slot="gem-effect-set"
                      className="mt-8 first-of-type:mt-4"
                    >
                      <h3 className="font-display text-xl leading-tight text-ink">
                        {set.label}
                        {!reference.support && (
                          <span className="ml-1 mono-label text-ink-muted">
                            {` · Level ${level ?? `1–${rangeEnd}`}`}
                          </span>
                        )}
                      </h3>
                      {/* A set's lines and quality belong to it: an
                            indent groups them under its heading. */}
                      <div className="mt-3 pl-3.5">
                        {set.lines.length > 0 && (
                          <EffectList
                            data-slot="gem-effect-lines"
                            className="space-y-2 text-lg leading-relaxed text-ink"
                          >
                            {set.lines.map((line, index) => (
                              <li key={index}>
                                {level === null ? (
                                  <GemKeywordText text={line} />
                                ) : (
                                  effectIncreaseParts(
                                    set.baselineLines,
                                    line
                                  ).map((part, partIndex) =>
                                    part.increase ? (
                                      <Fragment key={partIndex}>
                                        {" "}
                                        <GemLevelDelta
                                          text={part.text.trimStart()}
                                          slot="gem-effect-increase"
                                        />
                                      </Fragment>
                                    ) : (
                                      <GemKeywordText
                                        key={partIndex}
                                        text={part.text}
                                      />
                                    )
                                  )
                                )}
                              </li>
                            ))}
                          </EffectList>
                        )}
                        {set.qualityLines.length > 0 && (
                          <div className="mt-5">
                            <h4 className="mono-label text-ink-muted">
                              From {quality === null ? "1–20" : quality}%
                              quality
                            </h4>
                            <EffectList
                              data-slot="gem-quality-effects"
                              className="mt-3 space-y-2 text-lg leading-relaxed text-ink"
                            >
                              {set.qualityLines.map((line, index) => (
                                <li key={index}>
                                  <GemKeywordText text={line} />
                                </li>
                              ))}
                            </EffectList>
                          </div>
                        )}
                        {search.advancedQuality === 1 &&
                          set.gemlingQualityLines.length > 0 && (
                            <div className="mt-5">
                              <h4 className="mono-label text-brand">
                                From {quality === null ? "1–20" : quality}%
                                quality · Advanced Thaumaturgy
                              </h4>
                              <EffectList
                                data-slot="gem-gemling-quality-effects"
                                className="mt-3 space-y-2 text-lg leading-relaxed text-ink"
                              >
                                {set.gemlingQualityLines.map((line, index) => (
                                  <li key={index}>
                                    <GemKeywordText text={line} />
                                  </li>
                                ))}
                              </EffectList>
                            </div>
                          )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p role="status" className="mt-3 text-sm text-ink-muted">
                    {effects.isFetching
                      ? "Loading gem effects…"
                      : "Numerical effects are unavailable for this gem or level."}
                  </p>
                )}
              </TooltipProvider>
              {effectSets.some((set) => set.partial) && (
                <p className="mt-4 text-xs text-ink-muted">
                  Some values require additional context or are unavailable in
                  this reference.
                </p>
              )}
            </GemSection>
            <CompatibleGems
              key={reference.skillId}
              gem={reference}
              references={page.compatible}
              search={listSearch}
            />
          </div>
          <div className="min-w-0 max-lg:order-first">
            {!reference.support && (
              <GemSection aria-labelledby="gem-controls-title" className="py-6">
                <GemSectionTitle id="gem-controls-title">
                  Level & quality
                </GemSectionTitle>
                <div
                  data-slot="gem-controls"
                  className="mt-3 grid grid-cols-[auto_auto] justify-start justify-items-start gap-x-6 gap-y-5 px-[var(--shell-gutter)] max-sm:gap-x-4"
                >
                  <Field>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor="detail-gem-level">Level</FieldLabel>
                      <Button
                        type="button"
                        variant="link"
                        size="bare"
                        className="mono-label text-label underline"
                        aria-label="Unset gem level"
                        disabled={level === null}
                        onClick={() => setLevel(null)}
                      >
                        Unset
                      </Button>
                    </div>
                    <NumberStepper
                      id="detail-gem-level"
                      label="Gem level"
                      value={level}
                      rangeLabel={`1–${rangeEnd}`}
                      min={1}
                      max={40}
                      onValueChange={setLevel}
                      onClear={() => setLevel(null)}
                      externalClear
                      zeroUnsets
                      compact
                    />
                  </Field>
                  <Field>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor="detail-gem-quality">
                        Quality
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="link"
                        size="bare"
                        className="mono-label text-label underline"
                        aria-label="Unset gem quality"
                        disabled={quality === null}
                        onClick={() => setQuality(null)}
                      >
                        Unset
                      </Button>
                    </div>
                    <NumberStepper
                      id="detail-gem-quality"
                      label="Gem quality"
                      value={quality}
                      rangeLabel="1–20"
                      min={1}
                      max={62}
                      suffix="%"
                      onValueChange={setQuality}
                      onClear={() => setQuality(null)}
                      externalClear
                      zeroUnsets
                      compact
                    />
                  </Field>
                  <Toggle
                    variant="outline"
                    pressed={search.advancedQuality === 1}
                    onPressedChange={setAdvancedQuality}
                    className="col-span-2 h-10 gap-2 px-3 mono-label text-label text-ink-muted aria-pressed:border-brand-deep aria-pressed:bg-notice aria-pressed:text-brand"
                  >
                    {search.advancedQuality === 1 ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Square aria-hidden="true" />
                    )}
                    Advanced Thaumaturgy
                  </Toggle>
                </div>
              </GemSection>
            )}
            <GemSection aria-labelledby="gem-stats-title" className="pt-6">
              <GemSectionTitle id="gem-stats-title">Gem stats</GemSectionTitle>
              <TooltipProvider delay={0}>
                <StatsBody
                  data-slot="gem-properties"
                  className="mt-3 px-[var(--shell-gutter)]"
                >
                  {(
                    [
                      ["Properties", propertyRows],
                      ["Requirements", requirementRows],
                    ] as const
                  ).map(
                    ([title, rows]) =>
                      rows.length > 0 && (
                        <StatsSection key={title}>
                          <StatsHeading>{title}</StatsHeading>
                          <StatsList>
                            {rows.map(({ label, value, delta, tone }) => (
                              <StatsRow key={label} label={label}>
                                <span className={tone && toneClass[tone]}>
                                  {value}
                                </span>
                                {delta && (
                                  <span className="ml-2">
                                    <GemLevelDelta
                                      text={`(${delta})`}
                                      slot="gem-property-delta"
                                    />
                                  </span>
                                )}
                              </StatsRow>
                            ))}
                          </StatsList>
                        </StatsSection>
                      )
                  )}
                </StatsBody>
              </TooltipProvider>
            </GemSection>
          </div>
        </div>
      </GemKeywordProvider>
    </div>
  )
}
