import { cn } from "cn"
import { textLink } from "../components/ui/link-styles"
import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { useState } from "react"
import type * as React from "react"
import { z } from "zod"
import { getItemMeta } from "../lib/item-registry-meta"
import { shareMeta } from "../lib/share-meta"
import { useItemRegistry } from "../lib/use-item-registry"
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
import { BaseFormSwitch, RuneforgingPaths } from "../components/item-base-forms"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"
import { ItemModifierPool } from "../components/item-modifier-pool"

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
    const meta = await getItemMeta({ data: { slug: params.item } })
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
  const listSearch = {
    q: search.q,
    kind: search.kind,
    itemClass: search.itemClass,
    page: search.page,
  }
  const patch = (value: { variant?: number; baseForm?: string }) =>
    void navigate({
      search: (previous) => ({ ...previous, ...value }),
      replace: true,
      resetScroll: false,
    })
  // The loader already knows the name and art, so the masthead renders
  // before the catalogue arrives.
  const titleTone = item?.kind === "unique" ? uniqueTitle : undefined
  const name = item?.name ?? meta.name
  const image = item?.image ?? meta.image
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeading className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] pt-12">
        <Link
          to="/items"
          search={listSearch}
          className="absolute top-4 left-[var(--shell-gutter)] z-2 mono-label text-ink-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← All items
        </Link>
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
        {image && <ItemArt src={image} />}
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
          <div className="-mx-[var(--shell-gutter)] grid min-w-0 border-b border-rule-strong lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 lg:border-r lg:border-rule-strong">
              {item.kind === "unique" ? (
                <UniqueModifiers
                  item={item}
                  variant={search.variant ?? 0}
                  onVariant={(variant) => patch({ variant })}
                />
              ) : (
                <BaseImplicits item={base ?? item} />
              )}
            </div>
            <aside className="min-w-0 max-lg:border-t max-lg:border-rule-strong">
              <BaseLedger
                item={item}
                base={base}
                original={original !== base ? original : undefined}
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
                paths={
                  item.kind === "unique" && (
                    <RuneforgingPaths item={item} catalogue={catalogue.data} />
                  )
                }
              />
            </aside>
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
            <a href="/items/v1/source.json" className="text-brand underline">
              Snapshot sources and coverage
            </a>
            .
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

/* The item's own art, undithered, standing in the masthead's right side
 * on a faint bronze glow. */
function ItemArt({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div
      aria-hidden="true"
      className="relative z-1 ml-auto flex shrink-0 items-center justify-center self-stretch px-6 before:absolute before:inset-0 before:bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--color-brand)_14%,transparent),transparent)] before:content-[''] max-sm:px-0"
    >
      <img
        src={src}
        alt=""
        decoding="async"
        onError={() => setFailed(true)}
        className="relative max-h-44 w-auto max-w-40 object-contain drop-shadow-[0_8px_24px_rgb(0_0_0/0.6)] max-sm:max-h-24 max-sm:max-w-20"
      />
    </div>
  )
}

const modifierList =
  "m-0 list-none space-y-2 p-0 text-lg leading-relaxed font-medium"

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
            className={`${modifierList} mb-4 border-b border-rule pb-4 text-item-augment`}
          >
            {implicits.map((mod, index) => (
              <li key={`${mod.text}-${index}`}>{mod.text}</li>
            ))}
          </ul>
        )}
        {explicits.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No explicit modifiers. See the item details for sockets.
          </p>
        ) : (
          <ul className={`${modifierList} text-item-modifier`}>
            {explicits.map((mod, index) => (
              <li key={`${mod.text}-${index}`} className="whitespace-pre-line">
                {mod.text}
                {item.complex && mod.variants.length > 0 && (
                  <span className="mt-0.5 block mono-label font-normal text-ink-muted">
                    {mod.variants
                      .map(
                        (id) =>
                          item.variants.find((option) => option.id === id)?.name
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
  )
}

function BaseImplicits({ item }: { item: BaseReference }) {
  return (
    <GemSection aria-labelledby="item-implicits-title">
      <GemSectionTitle id="item-implicits-title">Implicits</GemSectionTitle>
      <div className="mt-5 px-[var(--shell-gutter)]">
        {item.implicits.length ? (
          <ul className={`${modifierList} text-item-augment`}>
            {item.implicits.map((text, index) => (
              <li key={index} className="whitespace-pre-line">
                {text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            This base has no implicit modifier.
          </p>
        )}
      </div>
    </GemSection>
  )
}

/* Unique metadata lines, normalised for a name/value ledger. */
function detailRows(item: UniqueReference) {
  return item.metadata.map((text) => {
    if (text.startsWith("Sockets:")) {
      const count = text.slice(8).trim().split(/\s+/).length
      return {
        label: "Sockets",
        value: `${count} ${text.includes("J") ? "jewel" : "augment"}`,
      }
    }
    const plain = text.replace(/(?:unique|normal)\{([^}]+)\}/g, "$1")
    const split = plain.indexOf(":")
    return split > 0
      ? { label: plain.slice(0, split), value: plain.slice(split + 1).trim() }
      : { label: plain, value: "" }
  })
}

/* "-5%" and "1.20" read as numbers; ranges such as "10–20" do not. */
function statNumber(value: string | undefined) {
  const match = value?.match(/^(-?\d+(?:\.\d+)?)(%?)$/)
  return match ? { amount: Number(match[1]), unit: match[2] } : undefined
}

/** The change from the original form, as the gem page shows level
 * changes: "(+53)" for Ward a form adds, "(−22)" for armour it trades. */
function statDelta(before: string | undefined, after: string) {
  const next = statNumber(after)
  if (!next) return null
  const previous = before === undefined ? 0 : statNumber(before)?.amount
  if (previous === undefined) return null
  const difference = Math.round((next.amount - previous) * 100) / 100
  if (difference === 0) return null
  return `(${difference > 0 ? "+" : "−"}${Math.abs(difference)}${next.unit})`
}

function ledgerRows(base?: BaseReference) {
  const rows = base ? baseStatRows(base) : []
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
  formSwitch,
  paths,
}: {
  item: ItemReference
  base?: BaseReference
  /** The family's original form, when the shown base is another form. */
  original?: BaseReference
  formSwitch?: React.ReactNode
  paths?: React.ReactNode
}) {
  const { properties, requirements } = ledgerRows(base)
  const before = original ? ledgerRows(original) : undefined
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
  const details = item.kind === "unique" ? detailRows(item) : []
  const groups = [
    ["Properties", properties],
    ["Requirements", requirements],
    ["Details", details],
  ] as const
  const tags = base?.tags.filter((tag) => tag !== "default") ?? []
  return (
    <GemSection aria-labelledby="item-base-title">
      <GemSectionTitle id="item-base-title">
        {item.kind === "unique" ? "Base" : "Base stats"}
      </GemSectionTitle>
      {formSwitch && (
        <div className="mt-4 grid gap-3 px-[var(--shell-gutter)]">
          {formSwitch}
          {paths}
        </div>
      )}
      {item.kind === "unique" && base && (
        <p className="mt-4 px-[var(--shell-gutter)] text-sm text-ink-muted">
          Unmodified{" "}
          <Link
            to="/items/$item"
            params={{ item: base.slug }}
            search={{ q: "", kind: "base", itemClass: "", page: 1 }}
            className="text-brand underline decoration-dotted underline-offset-4"
          >
            {base.name}
          </Link>{" "}
          values, before quality and unique modifiers.
        </p>
      )}
      <TooltipProvider delay={0}>
        <StatsBody className="mt-4 px-[var(--shell-gutter)]">
          {groups.map(
            ([title, list]) =>
              list.length > 0 && (
                <StatsSection key={title}>
                  <StatsHeading>{title}</StatsHeading>
                  <StatsList>
                    {list.map(({ label, value }) => {
                      const delta =
                        original && title !== "Details"
                          ? statDelta(previous.get(`${title}:${label}`), value)
                          : null
                      return (
                        <StatsRow key={label} label={label}>
                          <span
                            className={
                              title === "Requirements"
                                ? requirementTone[label]
                                : undefined
                            }
                          >
                            {value}
                          </span>
                          {delta && original && (
                            <FormDelta text={delta} original={original.name} />
                          )}
                        </StatsRow>
                      )
                    })}
                  </StatsList>
                </StatsSection>
              )
          )}
          {!base && details.length === 0 && (
            <p className="text-sm text-ink-muted">
              No base record is available for this item.
            </p>
          )}
        </StatsBody>
      </TooltipProvider>
      {tags.length > 0 && (
        <div className="mt-6 px-[var(--shell-gutter)]">
          <h3 className="mb-2 mono-label text-ink-muted">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag.replaceAll("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </GemSection>
  )
}

function FormDelta({ text, original }: { text: string; original: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        tabIndex={0}
        data-slot="base-form-delta"
        className="ml-2 cursor-pointer text-brand underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>Compared with {original}.</TooltipContent>
    </Tooltip>
  )
}

const requirementTone: Record<string, string> = {
  Strength: "text-tone-red",
  Dexterity: "text-tone-green",
  Intelligence: "text-tone-blue",
}
