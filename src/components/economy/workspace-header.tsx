import { navigationItem } from "../ui/navigation-styles"
import { Link } from "@tanstack/react-router"
import { ArrowUpRight, Gem, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SubNavigation } from "@/components/ui/sub-navigation"
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
import { LEAGUES } from "../../../shared/economy"
import { DISPLAY_CURRENCIES } from "../../../shared/display-currency"
import type { Filters } from "../../lib/economy-filters"
import { DisplayCurrencyLabel } from "./icon"

/* View switch on the left, league and display currency on the right. */
export function WorkspaceHeader({
  f,
  patch,
  moversPage,
  delayNotice,
}: {
  f: Filters
  patch: (values: Partial<Filters>) => void
  moversPage: boolean
  delayNotice?: string
}) {
  return (
    <div className="-mx-[var(--shell-gutter)] flex items-end justify-between gap-x-4 border-b border-rule-strong px-[var(--shell-gutter)] max-lg:flex-wrap">
      <SubNavigation aria-label="Economy views" className="max-lg:w-full">
        <Link
          to="/economy/market"
          search={f}
          aria-current={!moversPage ? "page" : undefined}
          className={navigationItem}
        >
          <Gem aria-hidden="true" />
          Currency market
        </Link>
        <Link
          to="/economy/movers"
          search={f}
          aria-current={moversPage ? "page" : undefined}
          className={navigationItem}
        >
          <ArrowUpRight aria-hidden="true" />
          Market movers
        </Link>
      </SubNavigation>
      <div className="flex items-end gap-4 py-3 max-lg:order-first max-lg:w-full">
        {delayNotice && (
          <Tooltip>
            <TooltipTrigger
              delay={0}
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end border-dotted border-brand-deep bg-notice text-brand hover:border-solid hover:text-brand-ink data-popup-open:border-solid data-popup-open:text-brand-ink max-lg:size-11 [&_svg]:size-4.25"
                  aria-label={delayNotice}
                />
              }
            >
              <TriangleAlert aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{delayNotice}</TooltipContent>
          </Tooltip>
        )}
        <LeagueSelect
          league={f.league}
          onLeague={(league) => patch({ league })}
          className="max-sm:flex-1"
        />
        <DisplayCurrencySelect
          quote={f.quote}
          onQuote={(quote) => patch({ quote })}
          className="max-sm:flex-1"
        />
      </div>
    </div>
  )
}

export function LeagueSelect({
  league,
  onLeague,
  className,
}: {
  league: Filters["league"]
  onLeague: (league: Filters["league"]) => void
  className?: string
}) {
  return (
    <Field className={className}>
      <FieldLabel id="league-label">League</FieldLabel>
      <Select
        value={league}
        onValueChange={(value) => {
          if (value) onLeague(value)
        }}
        items={LEAGUES.map((value) => ({ label: value, value }))}
      >
        <SelectTrigger
          aria-labelledby="league-label"
          size="sm"
          className="max-lg:min-h-11 max-sm:w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-max">
          {LEAGUES.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function DisplayCurrencySelect({
  quote,
  onQuote,
  className,
}: {
  quote: Filters["quote"]
  onQuote: (quote: Filters["quote"]) => void
  className?: string
}) {
  return (
    <Field className={className}>
      <FieldLabel id="quote-label">Display in</FieldLabel>
      <Select
        value={quote}
        onValueChange={(value) => {
          if (value) onQuote(value)
        }}
        items={DISPLAY_CURRENCIES.map((value) => ({ label: value, value }))}
      >
        <SelectTrigger
          aria-label="Quote currency"
          size="sm"
          className="max-lg:min-h-11 max-sm:w-full"
        >
          <SelectValue>
            <DisplayCurrencyLabel quote={quote} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-max">
          {DISPLAY_CURRENCIES.map((value) => (
            <SelectItem key={value} value={value}>
              <DisplayCurrencyLabel quote={value} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
