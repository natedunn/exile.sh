import { useState } from "react"
import { Minus, Plus, X } from "lucide-react"
import { cn } from "cn"
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "./input-group"
import { Button } from "./button"

type NumberStepperProps = {
  id: string
  label: string
  value: number | null
  min: number
  max: number
  onValueChange: (value: number) => void
  suffix?: string
  rangeLabel?: string
  onClear?: () => void
  clearLabel?: string
  externalClear?: boolean
  zeroUnsets?: boolean
  compact?: boolean
}

function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  onValueChange,
  suffix,
  rangeLabel,
  onClear,
  clearLabel,
  externalClear = false,
  zeroUnsets = false,
  compact = false,
}: NumberStepperProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? (value === null ? "" : String(value))
  const parsed = display === "" ? NaN : Number(display)
  const invalid =
    display !== "" &&
    (!Number.isInteger(parsed) || parsed < min || parsed > max)

  function commit() {
    if (Number.isInteger(parsed)) {
      if (zeroUnsets && parsed === 0) clear()
      else onValueChange(Math.min(max, Math.max(min, parsed)))
    }
    setDraft(null)
  }

  function step(amount: number) {
    const next = value === null ? (amount > 0 ? min : max) : value + amount
    if (zeroUnsets && next === 0) clear()
    else onValueChange(Math.min(max, Math.max(min, next)))
    setDraft(null)
  }

  function clear() {
    onClear?.()
    setDraft(null)
  }

  const control = (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={compact ? "h-10 w-9" : "h-11 w-10"}
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value !== null && value <= min && !zeroUnsets}
        onClick={() => step(-1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <InputGroup
        className={
          compact ? "h-10 w-18 justify-center" : "h-11 w-20 justify-center"
        }
      >
        <InputGroupInput
          id={id}
          aria-label={label}
          type="text"
          role="spinbutton"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={rangeLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value === null ? undefined : invalid ? value : parsed}
          aria-valuetext={
            value === null
              ? rangeLabel
              : suffix
                ? `${invalid ? value : parsed}${suffix}`
                : undefined
          }
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            const next = event.target.value
            if (!/^\d*$/.test(next)) return
            if (zeroUnsets && next && Number(next) === 0) {
              clear()
              return
            }
            setDraft(next)
            const number = Number(next)
            if (next && number >= min && number <= max) onValueChange(number)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              step(event.key === "ArrowUp" ? 1 : -1)
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault()
              onValueChange(event.key === "Home" ? min : max)
              setDraft(null)
            } else if (event.key === "Enter") {
              commit()
            }
          }}
          className={cn(
            "min-w-0 font-mono",
            compact ? "h-10" : "h-11",
            suffix
              ? cn(
                  value === null ? (compact ? "w-9" : "w-10") : "w-5",
                  "flex-none px-0 text-right"
                )
              : "px-1 text-center"
          )}
        />
        {suffix && (
          <InputGroupText className="pr-1 select-none">{suffix}</InputGroupText>
        )}
        {onClear && !clearLabel && !externalClear && value !== null && (
          <InputGroupButton
            size="icon-xs"
            aria-label={`Show ${label.toLowerCase()} range`}
            onClick={clear}
          >
            <X aria-hidden="true" />
          </InputGroupButton>
        )}
      </InputGroup>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={compact ? "h-10 w-9" : "h-11 w-10"}
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value !== null && value >= max}
        onClick={() => step(1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )

  if (!onClear || !clearLabel || externalClear) return control

  return (
    <div className="flex items-center gap-2">
      {control}
      <Button
        type="button"
        variant="link"
        size="bare"
        className="underline"
        aria-label={`${clearLabel} ${label.toLowerCase()}`}
        disabled={value === null}
        onClick={clear}
      >
        {clearLabel}
      </Button>
    </div>
  )
}

export { NumberStepper }
