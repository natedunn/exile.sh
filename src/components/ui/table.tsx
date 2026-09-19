import * as React from "react"
import { cn } from "cn"

function Table({
  className,
  scrollLabel = "Scrollable table",
  ...props
}: React.ComponentProps<"table"> & { scrollLabel?: string }) {
  // The scroll region only joins the tab order while it overflows in either
  // direction (wide tables scroll sideways; capped ones scroll down), so
  // keyboard users can scroll it without a stray focus stop when it fits.
  const container = React.useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = React.useState(false)
  React.useEffect(() => {
    const el = container.current
    if (!el) return
    const measure = () =>
      setOverflows(
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // The table itself can grow after data arrives without the frame moving.
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="max-w-full min-w-0">
      <p className="mb-2 hidden mono-label text-ink-muted">
        Scroll horizontally to see all columns →
      </p>
      <div
        ref={container}
        data-slot="table-container"
        role="region"
        aria-label={scrollLabel}
        tabIndex={overflows ? 0 : undefined}
        className="relative w-full max-w-full [scrollbar-color:var(--color-rule-strong)_var(--color-paper)] overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-hover/50 has-aria-expanded:bg-hover/50 data-[state=selected]:bg-hover",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-ink [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-ink-muted", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
