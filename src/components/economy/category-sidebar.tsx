import { Link } from "@tanstack/react-router"
import { ArrowRight, Gem, Star } from "lucide-react"
import { StatusDot } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HOUR } from "../../../shared/economy"
import type { ItemRow } from "../../../shared/economy"
import type { Filters } from "../../lib/economy-filters"
import { ago, utc } from "../../lib/format"
import { Icon, iconFrame } from "./icon"

export type CategoryOption = {
  category: string
  count: number
  mostTraded?: ItemRow
}

type Props = {
  f: Filters
  patch: (values: Partial<Filters>) => void
  options: CategoryOption[]
}

/* Phone widths: the category column folds into a select above the table. */
export function CategoryPicker({ f, patch, options }: Props) {
  const label = (category: string) => {
    const item = options.find(
      (option) => option.category === category
    )?.mostTraded
    return (
      <span className="inline-flex items-center gap-2">
        {category === "Watchlist" ? (
          <Star size={22} aria-hidden="true" />
        ) : item ? (
          <Icon key={item.id} id={item.id} size="sm" />
        ) : (
          <Gem size={22} aria-hidden="true" />
        )}
        {category}
      </span>
    )
  }
  const current = f.favorites ? "Watchlist" : f.category
  return (
    <Field className="hidden w-full max-lg:grid">
      <FieldLabel id="category-label">Category</FieldLabel>
      <Select
        value={current}
        onValueChange={(category) => {
          if (category)
            patch({
              favorites: category === "Watchlist",
              category: category === "Watchlist" ? "All currencies" : category,
            })
        }}
        items={["Watchlist", ...options.map((o) => o.category)].map(
          (category) => ({ label: category, value: category })
        )}
      >
        <SelectTrigger
          aria-labelledby="category-label"
          className="w-full max-lg:min-h-11"
        >
          <SelectValue>{label(current)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-max">
          <SelectItem value="Watchlist">{label("Watchlist")}</SelectItem>
          {options.map(({ category }) => (
            <SelectItem key={category} value={category}>
              {label(category)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/* One category row: the active one carries a bronze bar and a dot screen
   that fades out to the right. */
function CategoryButton({
  active,
  ...props
}: React.ComponentProps<typeof Button> & { active: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      active={active}
      aria-pressed={active}
      className="relative flex h-auto min-h-10.5 w-full items-center justify-between gap-2 rounded-none border-0 py-1 pr-3 pl-[var(--shell-gutter)] text-left text-sm text-ink-muted hover:bg-notice-strong hover:text-ink focus-visible:bg-notice-strong focus-visible:text-ink data-active:bg-notice data-active:text-ink data-active:before:pointer-events-none data-active:before:absolute data-active:before:inset-0 data-active:before:dot-screen data-active:before:mask-[linear-gradient(to_right,black,transparent_90%)] data-active:before:text-brand data-active:before:opacity-32 data-active:before:content-[''] data-active:after:absolute data-active:after:inset-y-0 data-active:after:left-0 data-active:after:w-0.75 data-active:after:bg-brand data-active:after:content-[''] data-active:hover:bg-notice-strong data-active:focus-visible:bg-notice-strong [&_small]:text-ink-faint data-active:[&_small]:text-brand [&_svg]:block"
      {...props}
    />
  )
}

export function CategorySidebar({
  f,
  patch,
  options,
  hour,
  now,
  favoriteCount,
  delayNotice,
}: Props & {
  hour: number
  now: number
  favoriteCount: number
  delayNotice?: string
}) {
  return (
    <aside
      data-testid="categories"
      className="sticky top-0 w-full min-w-0 max-lg:hidden"
    >
      {/* Freshness strip: as tall as the search strip beside it (its
          padding plus the field) so the two rules meet at the divider. */}
      <div className="grid min-h-22.25 content-center gap-0.5 border-b border-rule-strong px-[var(--shell-gutter)] mono-label text-ink-muted">
        <span className="text-ink-faint">Last fetched</span>
        {/* Relative to the end of the source hour, which is when its trades
            were complete. Before hydration there is no clock, so show the
            hour itself. */}
        {!now ? (
          utc(hour)
        ) : delayNotice ? (
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={
                <button
                  type="button"
                  className="cursor-pointer justify-self-start border-0 bg-transparent p-0 mono-label text-brand-ink underline decoration-dotted underline-offset-4"
                />
              }
            >
              {ago((hour + HOUR) * 1000, now)}
            </TooltipTrigger>
            <TooltipContent side="bottom">{delayNotice}</TooltipContent>
          </Tooltip>
        ) : (
          ago((hour + HOUR) * 1000, now)
        )}
      </div>
      <nav
        aria-label="Currency categories"
        className="flex flex-col gap-0.5 py-3"
      >
        <CategoryButton
          active={f.favorites}
          onClick={() => patch({ favorites: true, category: "All currencies" })}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className={iconFrame({ size: "category" })}>
              <Star size={18} />
            </span>
            Watchlist
          </span>
          <small className="mono-label">{favoriteCount}</small>
        </CategoryButton>
        {options.map(({ category, count, mostTraded }) => (
          <CategoryButton
            key={category}
            active={!f.favorites && f.category === category}
            onClick={() => patch({ category, favorites: false })}
          >
            <span className="flex min-w-0 items-center gap-3">
              {mostTraded && (
                <Icon key={mostTraded.id} id={mostTraded.id} size="category" />
              )}
              {category}
            </span>
            <small className="mono-label">{count}</small>
          </CategoryButton>
        ))}
      </nav>
      {/* Source note; not shown in the current layout. */}
      <div className="hidden">
        <StatusDot />
        <strong>Source: GGG Currency Exchange</strong>
        <p>
          Completed trades from GGG's official Currency Exchange. Updated hourly
          when collection is running.
        </p>
        <Link to="/methodology" search={f}>
          How prices work <ArrowRight size={12} />
        </Link>
      </div>
    </aside>
  )
}
