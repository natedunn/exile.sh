import { Search } from "lucide-react"
import { Field, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"

export function GemSearchField({
  id,
  value,
  onChange,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>Search gems</FieldLabel>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Name, tag, description, or effect text"
          className="h-11 pl-10"
        />
      </div>
    </Field>
  )
}
