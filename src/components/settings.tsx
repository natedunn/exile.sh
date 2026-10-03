import { useId } from "react"
import type { ReactNode } from "react"
import { cn } from "cn"
import { Panel } from "@/components/ui/panel"

/* A settings page's own heading: the serif title of the open subpage and
   a line on what lives there. */
export function SettingsHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="grid gap-2 border-b border-rule-strong pb-5">
      <h2 className="display text-section text-ink">{title}</h2>
      {children && (
        <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
          {children}
        </p>
      )}
    </header>
  )
}

/* One group of related settings: a heading, then a bordered stack of rows. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div className="grid gap-1">
        <h3 id={id} className="font-display text-2xl text-ink">
          {title}
        </h3>
        {description && (
          <p className="text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <Panel className="divide-y divide-rule">{children}</Panel>
    </section>
  )
}

/* A setting: what it is on the left, its control on the right. Narrow
   screens stack the control below. Checkbox rows pass `label` so the whole
   row toggles; other controls point `htmlFor` at their own id. */
export function SettingRow({
  title,
  description,
  htmlFor,
  label = false,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  htmlFor?: string
  label?: boolean
  children: ReactNode
}) {
  const Row = label ? "label" : "div"
  const Title = htmlFor ? "label" : "span"
  return (
    <Row
      className={cn(
        "grid items-center gap-x-8 gap-y-3 p-5 max-sm:p-4 sm:grid-cols-[minmax(0,1fr)_auto]",
        // A checkbox is small enough to stay beside its text.
        label &&
          "cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 hover:bg-hover has-disabled:cursor-default has-disabled:hover:bg-transparent"
      )}
    >
      <span className="grid min-w-0 gap-1">
        <Title htmlFor={htmlFor} className="text-base text-ink">
          {title}
        </Title>
        {description && (
          <span className="text-sm leading-relaxed text-ink-muted">
            {description}
          </span>
        )}
      </span>
      <span className="flex min-w-0 sm:justify-end">{children}</span>
    </Row>
  )
}
