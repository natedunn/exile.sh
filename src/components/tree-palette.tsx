import { useId, useSyncExternalStore } from "react"
import type { ComponentProps } from "react"
import { cn } from "cn"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Field, FieldLabel } from "./ui/field"

// Colour-vision palettes for the weapon set pair; keys match tokens.css.
const PALETTES = [
  { value: "default", label: "Standard colours" },
  { value: "deutan", label: "Deuteranopia (green-weak)" },
  { value: "protan", label: "Protanopia (red-weak)" },
  { value: "tritan", label: "Tritanopia (blue-weak)" },
  { value: "achroma", label: "Achromatopsia (no colour)" },
] as const
type Palette = (typeof PALETTES)[number]["value"]
const PALETTE_KEY = "exile.tree.palette"
const isPalette = (value: unknown): value is Palette =>
  PALETTES.some((p) => p.value === value)

/* The palette is one device preference shared by every tree on the page. It
   lives outside React so a change re-renders only the scopes and the picker,
   never the thousands of nodes beneath them. */
let current: Palette | undefined
const listeners = new Set<() => void>()
function read(): Palette {
  if (current === undefined) {
    try {
      const stored = localStorage.getItem(PALETTE_KEY)
      current = isPalette(stored) ? stored : "default"
    } catch {
      current = "default"
    }
  }
  return current
}
function write(value: Palette) {
  current = value
  try {
    localStorage.setItem(PALETTE_KEY, value)
  } catch {
    /* storage unavailable */
  }
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const useTreePalette = () =>
  useSyncExternalStore(subscribe, read, () => "default" as const)

/** A tree root that carries the saved palette as `data-palette`. */
export function TreePaletteScope(props: ComponentProps<"div">) {
  const palette = useTreePalette()
  return (
    <div
      {...props}
      data-palette={palette === "default" ? undefined : palette}
    />
  )
}

export function TreePaletteSelect() {
  const id = useId()
  return (
    <Field
      data-slot="tree-palette"
      className="border border-rule-strong bg-paper p-3 shadow-popup"
    >
      <FieldLabel htmlFor={id}>Color Blindness Mode</FieldLabel>
      <TreePalettePicker id={id} />
    </Field>
  )
}

/** The palette picker alone, for callers that bring their own label. */
export function TreePalettePicker({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  const palette = useTreePalette()
  return (
    <Select
      value={palette}
      items={PALETTES}
      onValueChange={(value) => {
        if (isPalette(value)) write(value)
      }}
    >
      <SelectTrigger
        id={id}
        optionLabels={PALETTES.map((p) => p.label)}
        className={cn("max-w-full", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PALETTES.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
