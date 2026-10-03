import { useRef } from "react"
import { Search, X } from "lucide-react"
import { cn } from "cn"
import { Field, FieldLabel } from "./ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./ui/input-group"

/* The labelled search box on the gems and items pages. Its clear button
   shows whenever there is text, not only while focused as the browser's own
   would, so that one is hidden. */
export function ReferenceSearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  className,
  inputClassName = "h-11",
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  /** Sets the box height, e.g. "h-9". */
  inputClassName?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className={cn("h-auto", disabled && "opacity-40")}>
        <InputGroupAddon className="pl-3">
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          id={id}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "pl-1 [&::-webkit-search-cancel-button]:appearance-none",
            inputClassName
          )}
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={`Clear ${label.toLocaleLowerCase()}`}
              onClick={() => {
                onChange("")
                input.current?.focus()
              }}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </Field>
  )
}
