import { cn } from "cn"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

/* Owns the container query for the Table's overflow hint: the hint paragraph
   the ui Table renders shows once the frame is narrower than the table.
   The Table has no prop for this yet, so its hint is reached as `div > p`. */
const hintAt = {
  currency: "@max-[1019px]:[&>div>p]:block",
  pairs: "@max-[749px]:[&>div>p]:block",
  history: "@max-[579px]:[&>div>p]:block",
} as const
export function TableFrame({
  hint,
  className,
  children,
}: {
  hint: keyof typeof hintAt
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "@container max-w-full min-w-0 [&>div>p]:mb-2 [&>div>p]:hidden [&>div>p]:mono-label [&>div>p]:text-ink-muted",
        hintAt[hint],
        className
      )}
    >
      {children}
    </div>
  )
}

/* Mono search strip; the hotkey pill steps aside once the field has focus. */
export function SearchField({
  className,
  children,
  ...props
}: React.ComponentProps<typeof InputGroupInput> & {
  className?: string
  children?: ReactNode
}) {
  return (
    <InputGroup
      className={cn(
        "h-10 min-w-0 flex-1 gap-2 px-3 text-ink-muted max-sm:px-2 [&>[data-slot=input-group-addon]]:p-0",
        className
      )}
    >
      <InputGroupAddon>
        <Search size={16} />
      </InputGroupAddon>
      <InputGroupInput
        className="h-9 min-w-0 px-0 py-0 font-mono text-xs text-ink"
        {...props}
      />
      {children}
    </InputGroup>
  )
}

export function SearchHotkey() {
  return (
    <InputGroupAddon align="inline-end">
      <span
        className="inline-flex items-center gap-1 font-mono text-label tracking-label-tight whitespace-nowrap text-ink-faint uppercase group-focus-within/input-group:hidden max-lg:hidden"
        aria-hidden="true"
      >
        Press{" "}
        <kbd className="rounded border border-rule-strong px-1.5 py-0.5 text-ink-muted [font:inherit]">
          F
        </kbd>
      </span>
    </InputGroupAddon>
  )
}

export function TableToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 pb-4 max-sm:gap-2", className)}
      {...props}
    />
  )
}

/* Footer strip of a table: a count, page position, and the page buttons. */
export function Pagination({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex min-h-14 items-center justify-end gap-6 border-t border-rule py-4 font-mono text-label font-medium tracking-[0.02em] text-ink-muted max-sm:flex-wrap max-sm:gap-2 [&>span:first-child]:mr-auto",
        className
      )}
      {...props}
    />
  )
}

export function PageButtons({
  previous,
  next,
  onPrevious,
  onNext,
  labels,
}: {
  previous: boolean
  next: boolean
  onPrevious: () => void
  onNext: () => void
  labels: [string, string]
}) {
  const button =
    "h-auto min-h-8.5 min-w-8.5 px-0 text-ink max-lg:min-h-11 max-sm:min-w-7.5"
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className={button}
        disabled={!previous}
        onClick={onPrevious}
        aria-label={labels[0]}
      >
        <ChevronLeft size={15} />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={button}
        disabled={!next}
        onClick={onNext}
        aria-label={labels[1]}
      >
        <ChevronRight size={15} />
      </Button>
    </div>
  )
}

/* The bordered mono action under an EmptyState. */
export function EmptyAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn("h-auto px-4.5 py-2.5 font-mono text-xs", className)}
      {...props}
    />
  )
}

export function SectionHeading({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("display text-section text-ink", className)} {...props} />
  )
}
