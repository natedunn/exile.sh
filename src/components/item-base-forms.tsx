import { cn } from "cn"
import { Link } from "@tanstack/react-router"
import type { BaseReference } from "../../shared/item-registry"
import { baseStatRows } from "../../shared/item-registry"
import { ReferenceSelect } from "./item-registry-controls"
import { buttonVariants } from "./ui/button"
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
  // Both read as one segmented control; base pages render each segment as
  // a link to that form's page, uniques as a button that swaps in place.
  const segments = (
    <SegmentedControl
      role={onSelect ? "group" : undefined}
      aria-label={onSelect ? "Base form" : undefined}
      className="flex w-full [&>*]:flex-1 max-sm:[&>*]:px-2"
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
          <Link
            to="/items/$item"
            params={{ item: base.slug }}
            search={baseSearch}
            resetScroll={false}
            key={base.slug}
            aria-current={base.slug === selected.slug ? "page" : undefined}
            className={cn(buttonVariants({ variant: "segment", size: "nav" }))}
          >
            {formName[base.form]}
          </Link>
        )
      )}
    </SegmentedControl>
  )
  return onSelect ? segments : <nav aria-label="Base form">{segments}</nav>
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
