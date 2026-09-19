import { TriangleAlert } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog"
import {
  StatsBody,
  StatsHeading,
  StatsList,
  StatsRow,
  StatsSection,
} from "./build/stats-ledger"
import {
  formattedStat,
  statCategory,
  statLabel,
} from "../../shared/build-stat-format"
import { displayStat } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

function FullDpsNotice() {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={0}
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-brand hover:bg-notice hover:text-brand-ink [&_svg:not([class*='size-'])]:size-[15px]"
            aria-label="Why is Full DPS zero?"
          />
        }
      >
        <TriangleAlert aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="left"
        className="w-75 gap-0 p-3 font-sans text-xs leading-relaxed"
        aria-label="About zero Full DPS"
      >
        Full DPS may be 0 because no skills were selected for “Include in Full
        DPS” in PoB. Check that option in PoB’s Skills tab and export the build
        again. This does not necessarily mean the build deals no damage.
      </PopoverContent>
    </Popover>
  )
}

export function BuildExpandedStats({ build }: { build: BuildSnapshot }) {
  const [category, setCategory] = useState("Character & utility")
  const categories = [
    "Character & utility",
    "Defences & resources",
    "Recovery",
    "Offence & skills",
  ]
  const sections = categories.map((title) => {
    const stats = build.stats.filter(
      (stat) => statCategory(stat.name) === title
    )
    return {
      title,
      stats:
        title === "Offence & skills"
          ? [
              ...stats.filter((stat) => stat.name === "FullDPS"),
              ...stats.filter((stat) => stat.name !== "FullDPS"),
            ]
          : stats,
    }
  })
  sections.push({ title: "Minion stats", stats: build.minionStats })
  const available = sections.filter(
    (section) =>
      section.stats.length ||
      (section.title === "Offence & skills" && build.fullDps.length)
  )
  const active =
    available.find((section) => section.title === category)?.title ??
    available.at(0)?.title ??
    ""
  const navigationLabels: Record<string, string> = {
    "Character & utility": "Character",
    "Defences & resources": "Defences",
    Recovery: "Recovery",
    "Offence & skills": "Skills",
    "Minion stats": "Minions",
  }
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="col-span-full h-auto min-h-10 w-full px-3 py-2 font-mono text-xs font-medium"
          />
        }
      >
        View all stats
      </DialogTrigger>
      {/* The dialog is the inspection tooltip's shell at page scale: a
          bronze dither wash from the top edge on the deep paper, with the
          bracketed corners of every floating surface. */}
      <DialogContent className="popup-corners h-[min(660px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[min(760px,calc(100vw-2rem))] max-w-[min(760px,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded border-rule-strong bg-paper-deep p-0 text-ink shadow-popup before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-64 before:bg-brand before:[mask-image:var(--dither-fade-y)] before:[mask-repeat:repeat-x] before:opacity-7 before:content-[''] sm:max-w-[min(760px,calc(100vw-2rem))]">
        <DialogHeader className="relative border-b border-rule-strong pt-6 pr-12 pb-4 pl-6 max-[641px]:pl-4">
          <DialogTitle className="font-display text-3xl leading-[1.1] font-medium text-brand">
            Expanded stats
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-ink-muted">
            Saved PoB values, grouped by purpose. Changing equipment or skills
            does not recalculate these values. Missing stats were not included
            in the export.
          </DialogDescription>
        </DialogHeader>
        {available.length ? (
          <Tabs
            value={active}
            onValueChange={(value) => setCategory(String(value))}
            className="relative flex min-h-0 flex-col gap-0"
          >
            <TabsList
              variant="line"
              className="flex h-12! w-full shrink-0 justify-start gap-6 rounded-none border-0 border-b border-rule-strong bg-transparent p-0 px-6 max-[641px]:hidden"
              aria-label="Stat categories"
            >
              {available.map(({ title }) => (
                <TabsTrigger
                  key={title}
                  value={title}
                  className="h-full flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent p-0 mono-label leading-none text-ink-muted after:hidden hover:text-ink data-active:border-brand data-active:bg-transparent data-active:text-ink"
                >
                  {navigationLabels[title]}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="hidden border-b border-rule-strong px-6 py-3 max-[641px]:block max-[641px]:p-4">
              <Select
                value={active}
                onValueChange={(value) => {
                  if (value) setCategory(value)
                }}
                items={available.map(({ title }) => ({
                  value: title,
                  label: title,
                }))}
              >
                <SelectTrigger
                  aria-label="Stat category"
                  className="min-h-10 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {available.map(({ title }) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {available.map(({ title, stats }) => (
              <TabsContent
                key={title}
                value={title}
                className="min-h-0 overflow-y-auto overscroll-contain p-6 max-[641px]:p-4"
              >
                <StatsBody layout="expanded">
                  <StatsSection>
                    <StatsHeading layout="expanded">{title}</StatsHeading>
                    <StatsList>
                      {stats.map((stat, index) => (
                        <StatsRow
                          key={`${stat.name}-${index}`}
                          label={statLabel(stat.name)}
                          wrap
                        >
                          <span className="inline-flex items-center gap-2">
                            {stat.name === "FullDPS" &&
                              stat.value.trim() !== "" &&
                              Number(stat.value) === 0 && <FullDpsNotice />}
                            {formattedStat(stat.name, stat.value)}
                          </span>
                        </StatsRow>
                      ))}
                    </StatsList>
                  </StatsSection>
                  {title === "Offence & skills" && build.fullDps.length > 0 && (
                    <StatsSection>
                      <StatsHeading layout="expanded">
                        Full DPS breakdown
                      </StatsHeading>
                      <StatsList>
                        {build.fullDps.map((skill, index) => (
                          <StatsRow
                            key={`${skill.name}-${index}`}
                            label={skill.name}
                            wrap
                          >
                            {displayStat(skill.value)}
                          </StatsRow>
                        ))}
                      </StatsList>
                    </StatsSection>
                  )}
                </StatsBody>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="p-6 text-sm text-ink-muted">
            No stats were included in this export.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
