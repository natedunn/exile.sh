import { Link } from "@tanstack/react-router"
import { ArrowUpRight, Gem, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  SubNavigation,
  SubNavigationItem,
} from "@/components/ui/sub-navigation"
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
  const link = { ...f, item: "" }
  const item = "max-sm:flex-1 max-sm:justify-center max-sm:gap-1 max-sm:px-2"
  return (
    <div className="-mx-[var(--shell-gutter)] flex items-center justify-between gap-x-4 border-b border-rule-strong px-[var(--shell-gutter)] max-sm:flex-wrap">
      <SubNavigation
        aria-label="Economy views"
        className="max-sm:w-full max-sm:justify-between"
      >
        <SubNavigationItem
          className={item}
          render={
            <Link
              to="/economy/market"
              search={link}
              aria-current={!moversPage ? "page" : undefined}
            />
          }
        >
          <Gem className="size-3.5" /> Currency market
        </SubNavigationItem>
        <SubNavigationItem
          className={item}
          render={
            <Link
              to="/economy/movers"
              search={link}
              aria-current={moversPage ? "page" : undefined}
            />
          }
        >
          <ArrowUpRight className="size-3.5" /> Market movers
        </SubNavigationItem>
      </SubNavigation>
      <div className="flex items-end gap-4 max-sm:order-first max-sm:w-full max-sm:py-3">
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
        <Field className="max-sm:flex-1">
          <FieldLabel id="league-label">League</FieldLabel>
          <Select
            value={f.league}
            onValueChange={(league) => {
              if (league) patch({ league, item: "" })
            }}
            items={LEAGUES.map((league) => ({ label: league, value: league }))}
          >
            <SelectTrigger
              aria-labelledby="league-label"
              size="sm"
              className="max-lg:min-h-11 max-sm:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-max">
              {LEAGUES.map((league) => (
                <SelectItem key={league} value={league}>
                  {league}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="max-sm:flex-1">
          <FieldLabel id="quote-label">Display in</FieldLabel>
          <Select
            value={f.quote}
            onValueChange={(quote) => {
              if (quote) patch({ quote })
            }}
            items={DISPLAY_CURRENCIES.map((quote) => ({
              label: quote,
              value: quote,
            }))}
          >
            <SelectTrigger
              aria-label="Quote currency"
              size="sm"
              className="max-lg:min-h-11 max-sm:w-full"
            >
              <SelectValue>
                <DisplayCurrencyLabel quote={f.quote} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-max">
              {DISPLAY_CURRENCIES.map((quote) => (
                <SelectItem key={quote} value={quote}>
                  <DisplayCurrencyLabel quote={quote} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  )
}
