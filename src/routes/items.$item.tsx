import { dataAssetUrl, dataReleaseKey } from "../../shared/data-assets"
import { cn } from "cn"
import { textLink } from "../components/ui/link-styles"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { Fragment, useState } from "react"
import type * as React from "react"
import { z } from "zod"
import { getItemMeta } from "../lib/item-registry-meta"
import { shareMeta } from "../lib/share-meta"
import { useItemRegistry } from "../lib/use-item-registry"
import { useItemBookmarks } from "../lib/use-saved-list"
import { BookmarkButton } from "../components/bookmark-toggle"
import type {
  BaseReference,
  ItemReference,
  UniqueReference,
} from "../../shared/item-registry"
import {
  itemBySlug,
  baseStatRows,
  relatedBases,
  uniqueBaseForms,
  uniqueModifiers,
} from "../../shared/item-registry"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Note } from "../components/ui/note"
import { EmptyState } from "../components/ui/empty-state"
import {
  PageHeading,
  PageHeadingCopy,
  PageTitle,
  PageMeta,
} from "../components/ui/page-heading"
import {
  StatsBody,
  StatsHeading,
  StatsList,
  StatsRow,
  StatsSection,
} from "../components/build/stats-ledger"
import { GemSection, GemSectionTitle } from "../components/gem-section"
import { ReferenceSelect } from "../components/item-registry-controls"
import { BaseFormSwitch } from "../components/item-base-forms"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover"
import { ItemModifierPool } from "../components/item-modifier-pool"
import {
  GemKeywordProvider,
  GemKeywordText,
} from "../components/gem-keyword-text"
import { uniqueStatRows } from "../../shared/unique-stats"

export const Route = createFileRoute("/items/$item")({
  validateSearch: (search): { variant?: number; baseForm?: string } => ({
    baseForm: z.string().optional().catch(undefined).parse(search.baseForm),
    variant: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .catch(undefined)
      .parse(search.variant),
  }),
  loader: async ({ params }) => {
    const meta = await getItemMeta({
      data: { slug: params.item, releaseId: dataReleaseKey },
    })
    if (!meta) throw notFound()
    return meta
  },
  head: ({ loaderData }) =>
    loaderData
      ? shareMeta({
          title: loaderData.name,
          description: loaderData.description,
          path: `/items/${loaderData.slug}`,
          image: `/og/items/${loaderData.slug}`,
        })
      : {},
  notFoundComponent: () => (
    <EmptyState>
      <h1 className="font-display text-2xl">Item not found</h1>
      <p>This item is not in the current reference snapshot.</p>
      <Link
        to="/items"
        search={{ q: "", kind: "unique", itemClass: "", page: 1 }}
        className={cn(
          textLink,
          "inline-flex items-center gap-1.5 [&_svg]:size-4"
        )}
      >
        Browse items
      </Link>
    </EmptyState>
  ),
  component: ItemDetailPage,
})

function ItemDetailPage() {
  const { item: slug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const meta = Route.useLoaderData()
  const catalogue = useItemRegistry()
  const item = catalogue.data ? itemBySlug(catalogue.data, slug) : undefined
  const { favorites, toggleFavorite } = useItemBookmarks()
  const ownBase =
    item?.kind === "base"
      ? item
      : item?.baseSlug && catalogue.data
        ? itemBySlug(catalogue.data, item.baseSlug)
        : undefined
  const forms =
    !item || !catalogue.data
      ? []
      : item.kind === "unique"
        ? uniqueBaseForms(catalogue.data, item)
        : relatedBases(catalogue.data, item)
  // A unique shows the form chosen in the URL; a base page is its own form.
  const base =
    (item?.kind === "unique" &&
      forms.find((form) => form.slug === search.baseForm)) ||
    (ownBase?.kind === "base" ? ownBase : undefined)
  const original = forms.find((form) => form.form === "original")
  // Back to the list with its filters, but never a query: `q` is not
  // carried onto item pages.
  const listSearch = {
    q: "",
    kind: search.kind,
    itemClass: search.itemClass,
    page: 1,
  }
  const patch = (value: { variant?: number; baseForm?: string }) =>
    void navigate({
      search: (previous) => ({ ...previous, ...value }),
      replace: true,
      resetScroll: false,
    })
  // The loader already knows the name and art, so the masthead renders
  // before the catalogue arrives.
  // A unique's figures include its own modifiers: the chosen variant's, or
  // on a complex unique only those every variant shares.
  // A base page lists the uniques built on it, and those a runeforging
  // recipe moves onto it.
  const uniquesOnBase =
    item?.kind === "base" && catalogue.data
      ? Object.values(catalogue.data.items).filter(
          (other): other is UniqueReference =>
            other.kind === "unique" &&
            (other.baseSlug === item.slug ||
              other.runeforging?.paths.some((path) => path.to === item.slug) ===
                true)
        )
      : []
  const uniqueTexts =
    item?.kind === "unique"
      ? (item.complex
          ? item.modifiers.filter((mod) => !mod.variants.length)
          : uniqueModifiers(item, search.variant ?? 0)
        ).map((mod) => mod.text)
      : undefined
  const titleTone = item?.kind === "unique" ? uniqueTitle : undefined
  const name = item?.name ?? meta.name
  const image = item?.image ?? meta.image
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] pt-12 max-sm:flex-wrap">
        <Link
          to="/items"
          search={listSearch}
          className="absolute top-4 left-[var(--shell-gutter)] z-2 mono-label text-ink-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← All items
        </Link>
        <div className="relative z-1 flex min-w-0 items-end gap-8 max-sm:basis-full max-sm:flex-col max-sm:items-start">
          {image && <ItemArt src={image} unique={meta.kind === "unique"} />}
          <PageHeadingCopy className="max-w-3xl">
            <PageTitle className={titleTone}>{name}</PageTitle>
            {item && (
              <PageMeta>
                <span>
                  <strong>{item.itemClass}</strong>
                </span>
                <span>
                  {item.kind === "unique" ? item.baseName : formLabel(item)}
                </span>
                {base && <span>Drop level {base.dropLevel}</span>}
              </PageMeta>
            )}
          </PageHeadingCopy>
        </div>
        <BookmarkButton
          bookmarked={favorites.includes(slug)}
          onClick={() => toggleFavorite(slug)}
          className="max-sm:ml-0"
        />
      </PageHeading>
      {catalogue.isError ? (
        <Note className="mt-6" role="alert">
          Item references could not be loaded.{" "}
          <Button
            variant="link"
            size="bare"
            onClick={() => void catalogue.refetch()}
          >
            Try again
          </Button>
        </Note>
      ) : catalogue.isPending ? (
        <p className="py-8 text-sm text-ink-muted" role="status">
          Loading item…
        </p>
      ) : !item ? (
        <EmptyState frame="dashed" className="mt-8">
          Item not found.{" "}
          <Link
            to="/items"
            search={listSearch}
            className="text-brand underline"
          >
            Browse items
          </Link>
        </EmptyState>
      ) : (
        <>
          {/* Modifiers then base stats, each the full width: a sidebar
              ledger beside a few modifier lines left most of the page
              empty, so the ledger's groups sit side by side instead. */}
          <div className="-mx-[var(--shell-gutter)] min-w-0 border-b border-rule-strong">
            {item.kind === "unique" ? (
              <UniqueModifiers
                item={item}
                variant={search.variant ?? 0}
                onVariant={(variant) => patch({ variant })}
              />
            ) : (
              // A base with no implicit shows no implicit section at all.
              (base ?? item).implicits.length > 0 && (
                <BaseImplicits item={base ?? item} />
              )
            )}
            <BaseLedger
              item={item}
              base={base}
              original={original !== base ? original : undefined}
              modifiers={uniqueTexts}
              uniques={uniquesOnBase}
              formSwitch={
                base &&
                forms.length > 1 && (
                  <BaseFormSwitch
                    forms={forms}
                    selected={base}
                    onSelect={
                      item.kind === "unique"
                        ? (baseForm) => patch({ baseForm })
                        : undefined
                    }
                  />
                )
              }
            />
          </div>
          {base && (
            <div className="-mx-[var(--shell-gutter)]">
              <ItemModifierPool
                key={base.slug}
                base={base}
                unique={item.kind === "unique"}
              />
            </div>
          )}
          <p className="mt-2 pb-10 text-xs leading-relaxed text-ink-muted">
            Game data and artwork © Grinding Gear Games. References:{" "}
            <a
              href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2"
              className="text-brand underline"
            >
              Path of Building
            </a>{" "}
            and{" "}
            <a
              href="https://repoe-fork.github.io/poe2/"
              className="text-brand underline"
            >
              RePoE
            </a>
            .{" "}
            <a
              href={dataAssetUrl("/items/v1/source.json")}
              className="text-brand underline"
            >
              Snapshot sources and coverage
            </a>
            .
            {item.kind === "unique" && item.runeforging && (
              <>
                {" "}
                <a
                  href={item.runeforging.source}
                  className="text-brand underline"
                >
                  Runeforging recipe source
                </a>{" "}
                ({item.runeforging.sourceVersion}).
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

const uniqueTitle = "text-item-unique"

function formLabel(item: BaseReference) {
  return item.form === "original"
    ? "Base item"
    : item.form === "runeforged"
      ? "Runeforged base"
      : "Runemastered base"
}

/* The item's own art, undithered, in the inventory frame the build page
 * uses for gear, so it sits in the masthead as an item rather than floating.
 * The frame is a fixed square; the art scales inside it and never squishes. */
function ItemArt({ src, unique }: { src: string; unique: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex size-36 shrink-0 max-sm:size-24"
    >
      <div
        className="item-slot p-2.5 max-sm:p-2 [&>img]:size-full"
        data-rarity={unique ? "UNIQUE" : undefined}
      >
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  )
}

/* Always bulleted here, whatever the tooltip layout setting: the same
 * half-tone disc and indent as the bullet layout in item tooltips. */
const modifierList =
  "m-0 list-disc space-y-2 p-0 text-lg leading-relaxed font-medium [&>li]:ml-[1.25em] [&>li::marker]:[color:color-mix(in_srgb,currentColor_50%,transparent)]"

function UniqueModifiers({
  item,
  variant,
  onVariant,
}: {
  item: UniqueReference
  variant: number
  onVariant: (variant: number) => void
}) {
  const selected = item.variants.some((option) => option.id === variant)
    ? variant
    : item.variants[0].id
  const effects = item.complex
    ? item.modifiers
    : uniqueModifiers(item, selected)
  const implicits = item.complex ? [] : effects.slice(0, item.implicitCount)
  const explicits = item.complex ? effects : effects.slice(item.implicitCount)
  return (
    <GemKeywordProvider>
      <GemSection aria-labelledby="item-modifiers-title">
        <GemSectionTitle id="item-modifiers-title">Modifiers</GemSectionTitle>
        {item.variants.length > 1 && !item.complex && (
          <div className="mt-4 max-w-sm px-[var(--shell-gutter)]">
            <ReferenceSelect
              id="unique-variant"
              label="Variant"
              value={String(selected)}
              options={item.variants.map((option) => ({
                value: String(option.id),
                label: option.name,
              }))}
              onChange={(value) => onVariant(Number(value))}
            />
          </div>
        )}
        <div
          className="mt-5 px-[var(--shell-gutter)]"
          data-testid="unique-modifiers"
        >
          {implicits.length > 0 && (
            <ul
              className={`${modifierList} mb-4 border-b border-rule pb-4 text-ink`}
            >
              {implicits.map((mod, index) => (
                <li key={`${mod.text}-${index}`}>
                  <GemKeywordText text={mod.text} />
                </li>
              ))}
            </ul>
          )}
          {explicits.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No explicit modifiers. See the item details for sockets.
            </p>
          ) : (
            <ul className={`${modifierList} text-ink`}>
              {explicits.map((mod, index) => (
                <li
                  key={`${mod.text}-${index}`}
                  className="whitespace-pre-line"
                >
                  <GemKeywordText text={mod.text} />
                  {item.complex && mod.variants.length > 0 && (
                    <span className="mt-0.5 block mono-label font-normal text-ink-muted">
                      {mod.variants
                        .map(
                          (id) =>
                            item.variants.find((option) => option.id === id)
                              ?.name
                        )
                        .filter(Boolean)
                        .join(" / ") || "Conditional variant"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {item.complex && (
            <Note className="mt-6">
              This unique has multiple variable modifier sets. The label under
              each modifier names its variants; they are alternatives, not one
              combined item.
            </Note>
          )}
        </div>
      </GemSection>
    </GemKeywordProvider>
  )
}

function BaseImplicits({ item }: { item: BaseReference }) {
  return (
    <GemKeywordProvider>
      <GemSection aria-labelledby="item-implicits-title">
        <GemSectionTitle id="item-implicits-title">Implicits</GemSectionTitle>
        <div className="mt-5 px-[var(--shell-gutter)]">
          <ul className={`${modifierList} text-ink`}>
            {item.implicits.map((text, index) => (
              <li key={index} className="whitespace-pre-line">
                <GemKeywordText text={text} />
              </li>
            ))}
          </ul>
        </div>
      </GemSection>
    </GemKeywordProvider>
  )
}

/* Unique metadata lines, normalised for a name/value ledger. */
function detailRows(item: UniqueReference) {
  return item.metadata.flatMap((text) => {
    // The level requirement belongs with the other requirements.
    if (levelLine.test(text)) return []
    if (text.startsWith("Sockets:")) {
      const count = text.slice(8).trim().split(/\s+/).length
      return [
        {
          label: "Sockets",
          value: `${count} ${text.includes("J") ? "jewel" : "augment"}`,
        },
      ]
    }
    const plain = text.replace(/(?:unique|normal)\{([^}]+)\}/g, "$1")
    const split = plain.indexOf(":")
    return [
      split > 0
        ? { label: plain.slice(0, split), value: plain.slice(split + 1).trim() }
        : { label: plain, value: "" },
    ]
  })
}

const levelLine = /^Requires Level (\d+)$/

/* A unique's own level requirement. Its modifiers can raise it above the
 * base's (Temporalis needs 64 on a level 22 Silk Robe); attributes stay
 * the base's. */
function uniqueLevel(item: ItemReference) {
  if (item.kind !== "unique") return undefined
  for (const text of item.metadata) {
    const match = text.match(levelLine)
    if (match) return match[1]
  }
  return undefined
}

function withLevel(
  requirements: { label: string; value: string }[],
  level?: string
) {
  return level
    ? [
        { label: "Level", value: level },
        ...requirements.filter((row) => row.label !== "Level"),
      ]
    : requirements
}

/* "-5%", "1.20" and "267–312" as a low/high pair; a figure such as
 * "(24–26) to (41–43)" does not compare. */
function statSpan(value: string | undefined) {
  const match = value?.match(/^(-?\d+(?:\.\d+)?)(?:–(-?\d+(?:\.\d+)?))?(%?)$/)
  if (!match) return undefined
  // An unmatched group is undefined at runtime, though typed as a string.
  const [, low, high = low, unit] = match as (string | undefined)[]
  return { low: Number(low), high: Number(high), unit: unit ?? "" }
}

/** The change from the original form, as the gem page shows level
 * changes: "(+53)" for Ward a form adds, "(−22)" for armour it trades,
 * "(−56 to −66)" where the figure is a rolled range. */
function statDelta(before: string | undefined, after: string) {
  const next = statSpan(after)
  if (!next) return null
  const previous = before === undefined ? { low: 0, high: 0 } : statSpan(before)
  if (!previous) return null
  const signed = (value: number) =>
    `${value > 0 ? "+" : "−"}${Math.abs(value)}${next.unit}`
  const low = Math.round((next.low - previous.low) * 100) / 100
  const high = Math.round((next.high - previous.high) * 100) / 100
  if (low === 0 && high === 0) return null
  return low === high
    ? `(${signed(low)})`
    : `(${signed(low)} to ${signed(high)})`
}

/** A unique's rows carry its own local modifiers; a base's are its own. */
function ledgerRows(base?: BaseReference, modifiers?: string[]) {
  const rows = !base
    ? []
    : modifiers
      ? uniqueStatRows(base, modifiers)
      : baseStatRows(base)
  return {
    properties: rows.filter(
      (row) => !row.label.startsWith("Requires ") && row.label !== "Drop level"
    ),
    requirements: rows
      .filter((row) => row.label.startsWith("Requires "))
      .map((row) => ({
        label: row.label.slice(9).replace(/^./, (first) => first.toUpperCase()),
        value: row.value,
      })),
  }
}

function BaseLedger({
  item,
  base,
  original,
  modifiers,
  uniques = [],
  formSwitch,
}: {
  item: ItemReference
  base?: BaseReference
  /** The family's original form, when the shown base is another form. */
  original?: BaseReference
  /** A unique's modifiers, applied to its base for its own figures. */
  modifiers?: string[]
  /** On a base page, the uniques that can be this base. */
  uniques?: UniqueReference[]
  formSwitch?: React.ReactNode
}) {
  const level = uniqueLevel(item)
  const rows = ledgerRows(base, modifiers)
  const { properties } = rows
  const requirements = withLevel(rows.requirements, level)
  // The original form compares under the same modifiers and unique level,
  // so only what the form itself changes reads as a difference.
  const originalRows = original ? ledgerRows(original, modifiers) : undefined
  // On a unique the comparison is the same unique on its original base.
  const compared = item.kind === "unique" ? item.name : original?.name
  const before = originalRows && {
    ...originalRows,
    requirements: withLevel(originalRows.requirements, level),
  }
  const previous = new Map(
    before
      ? [
          ...before.properties.map(
            (row) => [`Properties:${row.label}`, row.value] as const
          ),
          ...before.requirements.map(
            (row) => [`Requirements:${row.label}`, row.value] as const
          ),
        ]
      : []
  )
  // A unique names its base first, linked when the base has a page.
  const details =
    item.kind === "unique"
      ? [
          {
            label: "Base",
            value: base?.name ?? item.baseName,
            slug: base?.slug,
          },
          ...detailRows(item),
        ]
      : uniques.length
        ? [{ label: "Uniques", value: "", uniques }]
        : []
  const groups = [
    ["Properties", properties],
    ["Requirements", requirements],
    ["Details", details],
  ] as const
  const tags = base?.tags.filter((tag) => tag !== "default") ?? []
  return (
    <GemSection aria-labelledby="item-base-title">
      <GemSectionTitle id="item-base-title">Stats</GemSectionTitle>
      {formSwitch && (
        <div className="mt-4 grid px-[var(--shell-gutter)] lg:grid-cols-[minmax(0,26rem)]">
          {formSwitch}
        </div>
      )}
      <StatsBody className="mt-6 px-[var(--shell-gutter)] lg:grid-cols-4 lg:gap-x-10">
        {groups.map(
          ([title, list]) =>
            list.length > 0 && (
              <StatsSection key={title}>
                <StatsHeading>{title}</StatsHeading>
                <StatsList className="[&>*:last-child]:border-b-0">
                  {list.map((row) => {
                    const { label, value } = row
                    const slug = "slug" in row ? row.slug : undefined
                    const linked = "uniques" in row ? row.uniques : undefined
                    const delta =
                      original && title !== "Details"
                        ? statDelta(previous.get(`${title}:${label}`), value)
                        : null
                    return (
                      <StatsRow key={label} label={label}>
                        {linked ? (
                          <span>
                            {linked.map((unique, index) => (
                              <Fragment key={unique.slug}>
                                {index > 0 && ", "}
                                <Link
                                  to="/items/$item"
                                  params={{ item: unique.slug }}
                                  search={{
                                    q: "",
                                    kind: "unique",
                                    itemClass: "",
                                    page: 1,
                                    // Opened on this base when a recipe
                                    // moves the unique here.
                                    baseForm:
                                      unique.baseSlug === base?.slug
                                        ? undefined
                                        : base?.slug,
                                  }}
                                  className="text-brand underline decoration-dotted underline-offset-4"
                                >
                                  {unique.name}
                                </Link>
                              </Fragment>
                            ))}
                          </span>
                        ) : slug ? (
                          <Link
                            to="/items/$item"
                            params={{ item: slug }}
                            search={{
                              q: "",
                              kind: "base",
                              itemClass: "",
                              page: 1,
                            }}
                            className="text-brand underline decoration-dotted underline-offset-4"
                          >
                            {value}
                          </Link>
                        ) : (
                          <span
                            className={
                              title === "Requirements"
                                ? requirementTone[label]
                                : undefined
                            }
                          >
                            {value}
                          </span>
                        )}
                        {delta && compared && (
                          <FormDelta text={delta} original={compared} />
                        )}
                      </StatsRow>
                    )
                  })}
                </StatsList>
              </StatsSection>
            )
        )}
        {tags.length > 0 && (
          <StatsSection>
            <StatsHeading>Tags</StatsHeading>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  size="sm"
                  className="text-ink-soft"
                >
                  {tag.replaceAll("_", " ")}
                </Badge>
              ))}
            </div>
          </StatsSection>
        )}
      </StatsBody>
    </GemSection>
  )
}

/* Opens on hover and on tap, so touch screens can read it too. */
function FormDelta({ text, original }: { text: string; original: string }) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={0}
        data-slot="base-form-delta"
        className="ml-2 cursor-pointer text-brand underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {text}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-fit max-w-xs px-3 py-1.5 font-sans text-xs"
      >
        Compared with the original {original}.
      </PopoverContent>
    </Popover>
  )
}

const requirementTone: Record<string, string> = {
  Strength: "text-tone-red",
  Dexterity: "text-tone-green",
  Intelligence: "text-tone-blue",
}
