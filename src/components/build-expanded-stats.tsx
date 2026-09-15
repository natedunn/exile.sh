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
  formattedStat,
  statCategory,
  statLabel,
} from "../../shared/build-stat-format"
import { displayStat } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

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
            className="build-expanded-trigger"
          />
        }
      >
        View all stats
      </DialogTrigger>
      <DialogContent className="build-expanded-dialog popup-corners">
        <DialogHeader>
          <DialogTitle>Expanded stats</DialogTitle>
          <DialogDescription>
            Saved PoB values, grouped by purpose. Changing equipment or skills
            does not recalculate these values. Missing stats were not included
            in the export.
          </DialogDescription>
        </DialogHeader>
        {available.length ? (
          <Tabs
            value={active}
            onValueChange={(value) => setCategory(String(value))}
            className="build-expanded-tabs"
          >
            <TabsList
              variant="line"
              className="build-expanded-nav"
              aria-label="Stat categories"
            >
              {available.map(({ title }) => (
                <TabsTrigger key={title} value={title}>
                  {navigationLabels[title]}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="build-expanded-select">
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
                <SelectTrigger aria-label="Stat category">
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
                className="build-expanded-scroll"
              >
                <div className="build-stats-body build-expanded-grid">
                  <section>
                    <h3>{title}</h3>
                    <dl>
                      {stats.map((stat, index) => (
                        <div key={`${stat.name}-${index}`}>
                          <dt>{statLabel(stat.name)}</dt>
                          <dd>{formattedStat(stat.name, stat.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  {title === "Offence & skills" && build.fullDps.length > 0 && (
                    <section>
                      <h3>Full DPS breakdown</h3>
                      <dl>
                        {build.fullDps.map((skill, index) => (
                          <div key={`${skill.name}-${index}`}>
                            <dt>{skill.name}</dt>
                            <dd>{displayStat(skill.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="build-expanded-empty">
            No stats were included in this export.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
