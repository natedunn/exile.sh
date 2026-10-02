import { useDeferredValue, useId, useMemo, useRef, useState } from "react"
import { ChevronRight, Columns2, Package, Rows3 } from "lucide-react"
import { cn } from "cn"
import type {
  AugmentOutcome,
  BaseReference,
  EssenceOutcome,
  ModifierFamily,
  ModifierReference,
} from "../../shared/item-registry"
import {
  augmentOutcomes,
  baseInfluences,
  essenceOutcomes,
  modifierInfluence,
  modifierFamilies,
  modifierMatchesBase,
} from "../../shared/item-registry"
import {
  setModifierPoolLayout,
  useModifierPoolLayout,
} from "../lib/item-display-settings"
import { useItemModifiers } from "../lib/use-item-registry"
import { GemSection, GemSectionTitle } from "./gem-section"
import { Button } from "./ui/button"
import { Collapsible, CollapsibleContent } from "./ui/collapsible"
import { Field, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { Note } from "./ui/note"
import { NumberStepper } from "./ui/number-stepper"
import { SegmentedControl, SegmentedControlItem } from "./ui/segmented-control"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

const PAGE = 12

type Family = ModifierFamily & { available?: ModifierReference[] }

type Category =
  | {
      id: string
      title: string
      kind: "mods"
      tone: string
      families: Family[]
      /** The affix name the pool's modifiers share, such as "Medved's". */
      note?: string
      /** The line under each modifier: its affix name and tags (influences),
       * only the Abyssal lord it belongs to (desecrated), or nothing. */
      meta: Meta
    }
  | { id: string; title: string; kind: "essence"; rows: EssenceOutcome[] }
  | { id: string; title: string; kind: "augment"; rows: AugmentOutcome[] }

const modSources = [
  ["prefix", "Base prefixes", "normal", "prefix", "text-ink"],
  ["suffix", "Base suffixes", "normal", "suffix", "text-ink"],
  [
    "desecrated-prefix",
    "Desecrated prefixes",
    "desecrated",
    "prefix",
    "text-item-desecrated",
  ],
  [
    "desecrated-suffix",
    "Desecrated suffixes",
    "desecrated",
    "suffix",
    "text-item-desecrated",
  ],
] as const

type Meta = "full" | "lord" | "none"

/* Modifier lines are set in the serif, as the game sets them; each pool
 * supplies its colour. Subtext under a line keeps the mono label. */
const modifierText = "font-display text-lg leading-snug whitespace-pre-line"

/* "of Ulaman" and "Ulaman's" both name the lord; other desecrated
 * modifiers (Lightless, Breach) have none to show. */
const abyssalLord = (name: string) =>
  /\b(Ulaman|Kurgal|Amanamu)\b/.exec(name)?.[1]

/* Compound tags such as "fire_resistance" restate the plain ones. */
const displayTags = (tags: string[]) =>
  tags.filter((tag) => !tag.includes("_")).slice(0, 3)

/* Sort by wording, not by the roll ranges in front of it. */
const sortText = (text: string) =>
  text
    .replace(/[^a-z ]/gi, "")
    .trim()
    .toLocaleLowerCase()

const essenceFamily = (name: string) =>
  name.replace(/^(?:Lesser|Greater|Perfect) /, "")

const matches = (query: string, ...values: string[]) =>
  !query || values.join(" ").toLocaleLowerCase().includes(query)

/* One jump link per source: its prefix and suffix tables share a chip. */
function navGroups(categories: Category[]) {
  const groups = new Map<string, { id: string; label: string; count: number }>()
  for (const category of categories) {
    const label = category.title.replace(/ (?:prefixes|suffixes)$/, "")
    const count =
      category.kind === "mods" ? category.families.length : category.rows.length
    const group = groups.get(label)
    if (group) group.count += count
    else groups.set(label, { id: category.id, label, count })
  }
  return [...groups.values()]
}

/* Every modifier a base can carry, one table per source. Uniques only
 * show what can still change them: corruption and augments. */
export function ItemModifierPool({
  base,
  unique = false,
}: {
  base: BaseReference
  unique?: boolean
}) {
  const catalogue = useItemModifiers(true)
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState<number | null>(null)
  const search = useDeferredValue(query.trim().toLocaleLowerCase())

  const categories = useMemo(() => {
    if (!catalogue.data) return []
    const pool = Object.values(catalogue.data.mods).filter((mod) =>
      modifierMatchesBase(mod, base)
    )
    const families = (
      filter: (mod: ModifierReference) => boolean,
      from = pool
    ) =>
      modifierFamilies(from.filter(filter)).sort(
        (a, b) =>
          sortText(a.tiers[0].text).localeCompare(sortText(b.tiers[0].text)) ||
          a.key.localeCompare(b.key)
      )
    // Tiers of one essence sit together, weakest first.
    const essences = essenceOutcomes(catalogue.data, base).sort(
      (a, b) =>
        essenceFamily(a.essence).localeCompare(essenceFamily(b.essence)) ||
        a.level - b.level
    )
    const list: Category[] = [
      ...(unique
        ? []
        : modSources.map(([id, title, source, affix, tone]): Category => ({
            id,
            title,
            kind: "mods",
            tone,
            meta: source === "desecrated" ? "lord" : "none",
            families: families(
              (mod) => mod.source === source && mod.affix === affix
            ),
          }))),
      ...(unique
        ? []
        : (["prefix", "suffix"] as const).map((affix): Category => ({
            id: `essence-${affix}`,
            title: `Essence ${affix}es`,
            kind: "essence",
            rows: essences.filter((row) => row.affix === affix),
          }))),
      {
        id: "corrupted",
        title: "Corruption implicits",
        kind: "mods",
        tone: "text-negative",
        meta: "none",
        families: families((mod) => mod.source === "corruption"),
      },
      {
        id: "sacrifice",
        title: "Orb of Sacrifice",
        kind: "mods",
        tone: "text-negative",
        meta: "none",
        families: families((mod) => mod.source === "sacrifice"),
      },
      // Only the influences whose warp rune fits this base's slot.
      ...(unique
        ? []
        : baseInfluences(catalogue.data, base).flatMap(({ tag, label }) => {
            const influenced = Object.values(catalogue.data.mods).filter(
              (mod) =>
                modifierInfluence(mod, catalogue.data.influences)?.tag ===
                  tag && modifierMatchesBase(mod, base, [tag])
            )
            return (["prefix", "suffix"] as const).map((affix): Category => {
              const mods = influenced.filter((mod) => mod.affix === affix)
              return {
                id: `${tag}-${affix}`,
                title: `${label} ${affix}es`,
                kind: "mods",
                tone: "text-ink",
                meta: "full",
                families: families(() => true, mods),
                note: [...new Set(mods.map((mod) => mod.name))]
                  .filter(Boolean)
                  .join(" · "),
              }
            })
          })),
      {
        id: "augments",
        title: "Augments",
        kind: "augment",
        rows: augmentOutcomes(catalogue.data, base.itemClass),
      },
    ]
    return list.filter((category) =>
      category.kind === "mods"
        ? category.families.length > 0
        : category.rows.length > 0
    )
  }, [catalogue.data, base, unique])

  // Filters narrow each table; a category with nothing left still keeps its
  // heading so the page does not jump while typing.
  const filtered = categories.map((category) => {
    if (category.kind === "mods")
      return {
        ...category,
        families: category.families.flatMap((family) => {
          const tiers = family.tiers.filter(
            (mod) => level === null || mod.level <= level
          )
          return tiers.length &&
            family.tiers.some((mod) =>
              matches(search, mod.text, mod.name, ...mod.tags)
            )
            ? [{ ...family, available: tiers }]
            : []
        }),
      }
    if (category.kind === "essence")
      return {
        ...category,
        rows: category.rows.filter((row) =>
          matches(search, row.essence, row.text)
        ),
      }
    return {
      ...category,
      rows: category.rows.filter(
        (row) =>
          (level === null || row.level <= level) &&
          matches(search, row.name, row.type, ...row.text, ...row.bonded)
      ),
    }
  })

  const layout = useModifierPoolLayout()
  const sections = poolSections(filtered, layout)

  return (
    <GemSection
      aria-labelledby="modifier-pool-title"
      className="pb-12 [--pool-title:3.75rem]"
    >
      <GemSectionTitle id="modifier-pool-title">
        {unique ? "Corruption & augments" : "Modifier pool"}
      </GemSectionTitle>
      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 px-[var(--shell-gutter)]">
        <Field className="max-w-sm min-w-0 flex-1 max-sm:basis-full">
          <FieldLabel htmlFor="modifier-search">Search modifiers</FieldLabel>
          <Input
            id="modifier-search"
            type="search"
            value={query}
            placeholder="Life, resistance, attack…"
            onChange={(event) => setQuery(event.target.value)}
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-item-level">Item level</FieldLabel>
          <NumberStepper
            id="reference-item-level"
            label="Item level"
            min={1}
            max={100}
            value={level}
            rangeLabel="Any"
            onValueChange={setLevel}
            onClear={() => setLevel(null)}
            zeroUnsets
            compact
          />
        </Field>
        {!unique && (
          // Two columns need the room; narrow screens always stack.
          <Field className="ml-auto max-md:hidden">
            <span className="mono-label text-label text-ink-muted">Layout</span>
            <SegmentedControl role="group" aria-label="Modifier layout">
              {(
                [
                  ["split", "Split", Columns2],
                  ["stacked", "Stacked", Rows3],
                ] as const
              ).map(([value, label, Icon]) => (
                <SegmentedControlItem
                  key={value}
                  className="h-10 gap-2"
                  active={layout === value}
                  aria-pressed={layout === value}
                  onClick={() => setModifierPoolLayout(value)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Field>
        )}
      </div>
      {filtered.length > 0 && (
        <nav
          aria-label="Modifier categories"
          className="mt-5 flex flex-wrap gap-1.5 px-[var(--shell-gutter)]"
        >
          {navGroups(filtered).map((group) => (
            <a
              key={group.id}
              href={`#mods-${group.id}`}
              className="inline-flex h-7 items-center gap-2 rounded border border-rule-strong px-2 mono-label text-ink-muted hover:border-brand-deep hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {group.label}
              <span className="figure text-brand">{group.count}</span>
            </a>
          ))}
        </nav>
      )}
      {catalogue.isError ? (
        <Note className="mx-[var(--shell-gutter)] mt-6" role="alert">
          Modifiers could not be loaded.{" "}
          <Button
            variant="link"
            size="bare"
            onClick={() => void catalogue.refetch()}
          >
            Try again
          </Button>
        </Note>
      ) : catalogue.isPending ? (
        <p
          className="px-[var(--shell-gutter)] py-6 text-sm text-ink-muted"
          role="status"
        >
          Loading modifiers…
        </p>
      ) : (
        sections.map((section) => (
          <PoolSection key={section.columns[0].id} {...section} />
        ))
      )}
      <p className="mt-8 max-w-[70ch] px-[var(--shell-gutter)] text-xs leading-relaxed text-ink-muted">
        Eligibility comes from the base’s tags. Tiers are ordered by required
        item level; spawn weights are not published, so no probabilities are
        shown. This reference does not validate combinations or crafting steps.
      </p>
    </GemSection>
  )
}

const groupLabel = (category: Category) =>
  category.title.replace(/ (?:prefixes|suffixes)$/, "")

/* Split pairs each source's prefix and suffix tables in one section;
 * stacked gives every table its own. A source missing one side keeps the
 * other at full width. */
function poolSections(categories: Category[], layout: "split" | "stacked") {
  const sections: { title: string; columns: Category[] }[] = []
  for (const category of categories) {
    const previous = sections.at(-1)
    if (
      layout === "split" &&
      previous?.columns.length === 1 &&
      previous.columns[0].id.endsWith("prefix") &&
      category.id.endsWith("suffix") &&
      groupLabel(previous.columns[0]) === groupLabel(category)
    ) {
      previous.columns.push(category)
      previous.title = groupLabel(category)
    } else sections.push({ title: category.title, columns: [category] })
  }
  return sections
}

const isModCategory = (category: Category) => category.kind === "mods"

const countOf = (category: Category) =>
  category.kind === "mods" ? category.families.length : category.rows.length

const affixLabel = (category: Category) =>
  category.id.endsWith("prefix")
    ? "Prefixes"
    : category.id.endsWith("suffix")
      ? "Suffixes"
      : category.kind === "augment"
        ? "Augment"
        : "Modifier"

/* One source's tables. Side-by-side columns are subgrids of one grid, so
 * row n of the prefixes and row n of the suffixes always share a height,
 * and an opened tier list keeps the two sides level. */
function PoolSection({
  title,
  columns,
}: {
  title: string
  columns: Category[]
}) {
  const [limit, setLimit] = useState(PAGE)
  const split = columns.length > 1
  const longest = Math.max(...columns.map(countOf))
  const rows = Math.max(1, Math.min(longest, limit))
  // Reserve the chevron's slot only where some row can open; single-tier
  // pools (desecrated, corruption) start their text at the inset. Decided
  // per section, so the two sides of a split always indent alike.
  const chevrons = columns.some(
    (column) =>
      column.kind === "mods" &&
      column.families.some((family) => family.tiers.length > 1)
  )
  const sectionId = `mods-${columns[0].id}`
  return (
    <section
      aria-labelledby={`${sectionId}-title`}
      id={sectionId}
      className="mt-7"
    >
      {/* The title and the column headers below it stay pinned while their
          section is on screen, and leave with its last row. */}
      <h3
        id={`${sectionId}-title`}
        className="sticky top-0 z-3 flex h-(--pool-title) items-end gap-3 border-b border-rule-strong bg-paper px-[var(--shell-gutter)] pb-3 font-display text-2xl leading-tight text-ink [&>span]:mb-0.5"
      >
        {title}
        {!split && (
          <span className="mono-label text-ink-muted">
            {countOf(columns[0])}{" "}
            {columns[0].kind === "mods" ? "families" : "options"}
          </span>
        )}
      </h3>
      {columns[0].kind === "augment" ? (
        <div data-testid={`modifier-table-${columns[0].id}`}>
          {countOf(columns[0]) === 0 ? (
            <Empty />
          ) : (
            <AugmentTable rows={columns[0].rows.slice(0, limit)} />
          )}
        </div>
      ) : (
        <div className={cn("grid", split && "md:grid-cols-2")}>
          {columns.map((category, index) => (
            <PoolColumn
              key={category.id}
              category={category}
              rows={rows}
              limit={limit}
              split={split}
              side={split ? (index === 0 ? "left" : "right") : "full"}
              chevrons={chevrons}
            />
          ))}
        </div>
      )}
      {longest > limit && (
        <div className="border-t border-rule px-[var(--shell-gutter)] pt-3">
          <Button
            variant="link"
            size="bare"
            className="mono-label"
            onClick={() => setLimit(longest)}
          >
            Show all {columns.reduce((sum, column) => sum + countOf(column), 0)}
          </Button>
        </div>
      )}
    </section>
  )
}

/* Every table, on either side of a split, insets its content by the same
 * shell gutter from both of its edges, so the two sides mirror each other
 * and line up with the section title. */
const tablePadding = {
  first: "pl-[var(--shell-gutter)]",
  last: "pr-[var(--shell-gutter)]",
}

const columnDivider = "md:border-r md:border-r-rule-strong"

/* A ruled table: modifier, tier and item level, with a vertical rule
 * between each column running the full height of the row. */
// The item level column carries the closing gutter as well as its figure.
const modGrid =
  "grid grid-cols-[minmax(0,1fr)_4.25rem_calc(var(--shell-gutter)+2.75rem)]"
const ruledCell = "border-l border-rule px-3 text-right figure text-sm"
// Header labels keep the mono label size, not the figures' text size.
const headerRule = "border-l border-rule px-3 text-right"
// Opaque, so rows scrolling under the pinned header never show through.
const headerTint =
  "bg-[color-mix(in_oklch,var(--color-brand)_7%,var(--color-paper))]"

function PoolColumn({
  category,
  rows,
  limit,
  split,
  side,
  chevrons,
}: {
  category: Category
  rows: number
  limit: number
  split: boolean
  side: "full" | "left" | "right"
  chevrons: boolean
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) =>
    setOpen((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const total = countOf(category)
  const padding = tablePadding
  // The left column carries the rule between the two sides.
  const divider = side === "left" ? columnDivider : undefined
  const isMods = isModCategory(category)
  const rowRule = cn("border-b border-rule", divider)
  const shown = total === 0 ? 1 : Math.min(total, limit)
  const filler = rows - shown
  return (
    <div
      data-testid={`modifier-table-${category.id}`}
      role="table"
      aria-label={category.title}
      // The header plus one track per row of the longer side.
      style={{ gridRow: `span ${rows + 1}` }}
      className="grid grid-rows-subgrid"
    >
      <div
        role="row"
        className={cn(
          "sticky top-(--pool-title) z-2 border-b border-b-rule-strong",
          headerTint,
          divider,
          isMods ? modGrid : "grid"
        )}
      >
        <span
          role="columnheader"
          className={cn(
            "flex flex-wrap items-baseline gap-x-2 py-2.5 pr-3 mono-label text-ink-muted",
            padding.first,
            !isMods && padding.last
          )}
        >
          {split ? affixLabel(category) : "Modifier"}
          {split && <span className="figure text-brand">{total}</span>}
          {category.kind === "mods" && category.note && (
            <span className="text-brand-muted">{category.note}</span>
          )}
        </span>
        {category.kind === "mods" && (
          <>
            <span
              role="columnheader"
              className={cn(headerRule, "py-2.5 mono-label text-ink-muted")}
            >
              Tier
            </span>
            <span
              role="columnheader"
              className={cn(
                headerRule,
                "py-2.5 mono-label text-ink-muted",
                padding.last
              )}
            >
              iLvl
            </span>
          </>
        )}
      </div>
      {total === 0 ? (
        <Empty className={cn(rowRule, padding.first, padding.last)} />
      ) : category.kind === "mods" ? (
        category.families
          .slice(0, limit)
          .map((family) => (
            <FamilyRow
              key={family.key}
              family={family}
              tone={category.tone}
              meta={category.meta}
              chevrons={chevrons}
              className={rowRule}
              padding={padding}
              expanded={open.has(family.key)}
              onToggle={() => toggle(family.key)}
            />
          ))
      ) : category.kind === "essence" ? (
        category.rows.slice(0, limit).map((outcome) => (
          <div
            key={`${outcome.essence}:${outcome.id}`}
            role="row"
            className={cn(rowRule, "hover:bg-hover/40")}
          >
            <p
              role="cell"
              className={cn(
                cn(modifierText, "py-3 text-ink"),
                padding.first,
                padding.last
              )}
            >
              {outcome.text}
              <span className="mt-0.5 block mono-label leading-relaxed font-normal text-brand-muted">
                {outcome.essence}
              </span>
            </p>
          </div>
        ))
      ) : null}
      {filler > 0 && (
        // The shorter side keeps its rules down to the end of the section.
        <div
          aria-hidden="true"
          style={{ gridRow: `span ${filler}` }}
          className={cn(rowRule, isMods && modGrid)}
        >
          {isMods && (
            <>
              <span />
              <span className={headerRule} />
              <span className={headerRule} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Empty({ className }: { className?: string }) {
  return (
    <p className={cn("py-4 text-sm text-ink-muted", className)}>
      Nothing matches these filters.
    </p>
  )
}

function FamilyRow({
  family,
  tone,
  meta,
  chevrons,
  className,
  padding,
  expanded,
  onToggle,
}: {
  family: Family
  tone: string
  meta: Meta
  chevrons: boolean
  className: string
  padding: { first: string; last: string }
  expanded: boolean
  onToggle: () => void
}) {
  const tiers = family.available ?? family.tiers
  const best = tiers[0]
  const tier = family.tiers.indexOf(best) + 1
  const expandable = family.tiers.length > 1
  const press = useRef<{ x: number; y: number } | null>(null)
  const panelId = useId()
  const metaLine =
    meta === "full"
      ? [best.name, ...displayTags(best.tags)].filter(Boolean).join(" · ")
      : meta === "lord"
        ? abyssalLord(best.name)
        : undefined
  return (
    // A flex column; the closing filler takes any height a taller row on
    // the other side adds, so the column rules always reach the bottom.
    <Collapsible
      open={expanded}
      role="row"
      className={cn(className, "flex flex-col")}
    >
      {/* The summary line toggles the tiers and alone takes the hover. A
          press that moves is a text selection, not a click, so dragging to
          copy a modifier never toggles; a press that stays put always does,
          whatever else is selected. Repeat clicks would select a word, so
          they toggle again instead. The chevron is the keyboard control;
          its click bubbles here and toggles once. */}
      <div
        className={cn(
          modGrid,
          "group/family hover:bg-hover/40",
          // Collapsed, the line takes any height the other side adds, so
          // the hover and the click target fill the row.
          !expanded && "grow",
          expandable && "cursor-pointer"
        )}
        onPointerDown={
          expandable
            ? (event) => {
                press.current = { x: event.clientX, y: event.clientY }
              }
            : undefined
        }
        onMouseDown={
          expandable
            ? (event) => {
                if (event.detail > 1) event.preventDefault()
              }
            : undefined
        }
        onClick={
          expandable
            ? (event) => {
                const start = press.current
                press.current = null
                if (
                  start &&
                  Math.hypot(event.clientX - start.x, event.clientY - start.y) >
                    4
                )
                  return
                onToggle()
              }
            : undefined
        }
      >
        <div
          role="cell"
          className={cn(
            "flex min-w-0 items-start gap-2 py-3 pr-3",
            padding.first
          )}
        >
          {expandable ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={`${expanded ? "Hide" : "Show"} all ${family.tiers.length} tiers`}
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-ink-muted group-hover/family:text-brand focus-visible:outline-2 focus-visible:outline-focus"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            chevrons && <span className="size-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className={cn(modifierText, tone)}>{best.text}</p>
            {metaLine && (
              <p className="mt-0.5 mono-label text-ink-muted">{metaLine}</p>
            )}
          </div>
        </div>
        <span role="cell" className={cn(ruledCell, "py-3 text-ink-muted")}>
          {expandable ? (
            <>
              T{tier}
              <span className="text-ink-faint">/{family.tiers.length}</span>
            </>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </span>
        <span
          role="cell"
          className={cn(ruledCell, "py-3 text-ink", padding.last)}
        >
          {best.level}
        </span>
      </div>
      {/* Base UI measures the tiers and keeps them mounted until the close
          finishes, so both directions are one short height transition. */}
      <CollapsibleContent
        id={panelId}
        className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-180 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none"
      >
        <ol className="m-0 list-none border-t border-rule bg-paper-deep/60 p-0">
          {family.tiers.map((mod, index) => (
            <li
              key={mod.id}
              className={cn(
                modGrid,
                "border-b border-rule/60 last:border-b-0",
                !tiers.includes(mod) && "opacity-45"
              )}
            >
              <div
                className={cn("flex min-w-0 gap-2 py-2 pr-3", padding.first)}
              >
                <span className="size-5 shrink-0" />
                <div className="min-w-0">
                  <p className={cn(modifierText, tone)}>{mod.text}</p>
                  {meta === "full" && mod.name && (
                    <p className="mono-label text-ink-muted">{mod.name}</p>
                  )}
                </div>
              </div>
              <span className={cn(ruledCell, "py-2 text-ink-muted")}>
                T{index + 1}
              </span>
              <span
                className={cn(ruledCell, "py-2 text-ink-muted", padding.last)}
              >
                {mod.level}
              </span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
      <div aria-hidden="true" className={cn(modGrid, expanded && "grow")}>
        <span />
        <span className={headerRule} />
        <span className={headerRule} />
      </div>
    </Collapsible>
  )
}

const head = "h-9 mono-label font-normal text-ink-muted"
const columnRule = "border-l border-rule px-3"
const firstCell = "pl-[var(--shell-gutter)]"
const lastCell = "pr-[var(--shell-gutter)]"
const row = "border-rule hover:bg-hover/40"

function AugmentTable({ rows }: { rows: AugmentOutcome[] }) {
  return (
    <Table scrollLabel="Augments">
      <TableHeader>
        <TableRow className="border-rule-strong hover:bg-transparent">
          <TableHead className={cn(head, firstCell)}>Augment</TableHead>
          <TableHead className={cn(head, columnRule)}>Effect</TableHead>
          <TableHead className={cn(head, columnRule, lastCell, "text-right")}>
            Level
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((augment) => (
          <TableRow key={augment.id} className={row}>
            <TableCell className={cn(firstCell, "w-0 py-3 pr-3 align-top")}>
              <div className="flex items-center gap-3">
                {augment.image ? (
                  <img
                    src={augment.image}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    className="size-8 shrink-0 object-contain"
                  />
                ) : (
                  <Package
                    aria-hidden="true"
                    className="size-8 shrink-0 p-1.5 text-ink-muted"
                  />
                )}
                <div>
                  <p className="text-sm text-ink">{augment.name}</p>
                  <p className="mono-label text-ink-muted">{augment.type}</p>
                </div>
              </div>
            </TableCell>
            <TableCell
              className={cn(columnRule, "py-3 align-top whitespace-normal")}
            >
              {augment.text.map((line) => (
                <p key={line} className={cn(modifierText, "text-ink")}>
                  {line}
                </p>
              ))}
              {augment.bonded.map((line) => (
                <p
                  key={line}
                  className="text-sm leading-relaxed whitespace-pre-line text-ink-muted"
                >
                  <span className="mono-label text-brand-muted">Bonded </span>
                  {line}
                </p>
              ))}
            </TableCell>
            <TableCell
              className={cn(
                columnRule,
                lastCell,
                "py-3 text-right align-top figure"
              )}
            >
              {augment.level || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
