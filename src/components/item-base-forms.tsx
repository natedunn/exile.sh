import { Link } from "@tanstack/react-router"
import type {
  BaseReference,
  ItemCatalogue,
  UniqueReference,
} from "../../shared/item-registry"
import { baseStatRows } from "../../shared/item-registry"
import { ReferenceSelect } from "./item-registry-controls"
import { SegmentedControl, SegmentedControlItem } from "./ui/segmented-control"

const formName = {
  original: "Original",
  runeforged: "Runeforged",
  runemastered: "Runemastered",
}

const baseSearch = { q: "", kind: "base" as const, itemClass: "", page: 1 }

/* Original, Runeforged and Runemastered forms of one base, at the head of
 * the stats ledger. Base pages link between the forms' own pages; unique
 * pages swap the base in place. Same-name alternatives (Runic Fork) need
 * more than the form to tell apart, so they fall back to a select. */
export function BaseFormSwitch({
  forms,
  selected,
  onSelect,
}: {
  forms: BaseReference[]
  selected: BaseReference
  /** Omitted on base pages, where each form is its own page. */
  onSelect?: (slug: string) => void
}) {
  const distinct = new Set(forms.map((base) => base.form)).size === forms.length
  if (!distinct)
    return (
      <ReferenceSelect
        id="base-form"
        label="Base form"
        value={selected.slug}
        options={forms.map((base) => ({
          value: base.slug,
          label: `${base.name} · ${disambiguation(base)}`,
        }))}
        onChange={(slug) => onSelect?.(slug)}
      />
    )
  const ordered = [...forms].sort(
    (a, b) =>
      Object.keys(formName).indexOf(a.form) -
      Object.keys(formName).indexOf(b.form)
  )
  return (
    <SegmentedControl
      role="group"
      aria-label="Base form"
      className="flex w-full [&>*]:flex-1"
    >
      {ordered.map((base) =>
        onSelect ? (
          <SegmentedControlItem
            key={base.slug}
            active={base.slug === selected.slug}
            aria-pressed={base.slug === selected.slug}
            onClick={() => onSelect(base.slug)}
          >
            {formName[base.form]}
          </SegmentedControlItem>
        ) : (
          <SegmentedControlItem
            key={base.slug}
            aria-current={base.slug === selected.slug ? "page" : undefined}
            render={
              <Link
                to="/items/$item"
                params={{ item: base.slug }}
                search={baseSearch}
                resetScroll={false}
              />
            }
          >
            {formName[base.form]}
          </SegmentedControlItem>
        )
      )}
    </SegmentedControl>
  )
}

function disambiguation(base: BaseReference) {
  return (
    base.implicits[0] ||
    baseStatRows(base)
      .filter((row) =>
        ["Armour", "Evasion rating", "Energy shield", "Runic Ward"].includes(
          row.label
        )
      )
      .map((row) => `${row.label} ${row.value}`)
      .join(", ")
  )
}

/* The recorded upgrade paths behind a unique's form choices. */
export function RuneforgingPaths({
  item,
  catalogue,
}: {
  item: UniqueReference
  catalogue: ItemCatalogue
}) {
  if (!item.runeforging) return null
  return (
    <div className="text-xs leading-relaxed text-ink-muted">
      <ul className="m-0 list-none space-y-1 p-0">
        {item.runeforging.paths.map((path) => (
          <li key={path.craftId}>
            {catalogue.items[path.from].name} →{" "}
            <span className="text-ink-soft">
              {catalogue.items[path.to].name}
            </span>
          </li>
        ))}
      </ul>
      <a
        href={item.runeforging.source}
        className="mt-2 inline-block text-brand underline decoration-dotted underline-offset-4"
      >
        Recipe source · {item.runeforging.sourceVersion}
      </a>
    </div>
  )
}
