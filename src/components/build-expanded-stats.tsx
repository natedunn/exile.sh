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
import type { BuildSnapshot } from "../../shared/pob"

export function BuildExpandedStats({ build }: { build: BuildSnapshot }) {
  const categories = [
    "Character & utility",
    "Defences & resources",
    "Recovery",
    "Offence & skills",
  ]
  const sections = categories.map((title) => ({
    title,
    stats: build.stats.filter((stat) => statCategory(stat.name) === title),
  }))
  sections.push({ title: "Minion stats", stats: build.minionStats })
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
      <DialogContent className="build-expanded-dialog">
        <DialogHeader>
          <DialogTitle>Expanded stats</DialogTitle>
          <DialogDescription>
            Saved PoB values, grouped by purpose. Changing equipment or skills
            does not recalculate these values. Missing stats were not included
            in the export.
          </DialogDescription>
        </DialogHeader>
        <div
          className="build-expanded-scroll"
          tabIndex={0}
          role="region"
          aria-label="All exported stats"
        >
          <div className="build-stats-body build-expanded-grid">
            {sections
              .filter((section) => section.stats.length)
              .map(({ title, stats }) => (
                <section key={title}>
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
              ))}
            {!build.stats.length && !build.minionStats.length && (
              <p>No stats were included in this export.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
