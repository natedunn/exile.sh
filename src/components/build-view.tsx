import { GemReferenceInfo, SkillGems } from "./skill-gems"
import { BuildStats } from "./build-stats"
import {
  EquipmentDisplay,
  WeaponSetSwitch,
  equipmentHasSwap,
} from "./equipment-display"
import type { WeaponSet } from "./equipment-display"
import { PassiveTree } from "./passive-tree"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Check,
  Copy,
  Download,
  Gem,
  Link2,
  ScrollText,
  Shield,
  Swords,
  Waypoints,
} from "lucide-react"
import { Button } from "./ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { parseBuild } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"
import { classPortraits } from "../../shared/class-art"

const sections = [
  { id: "equipment", label: "Equipment", icon: Swords },
  { id: "skills", label: "Skills", icon: Gem },
  { id: "tree", label: "Trees", icon: Waypoints },
  { id: "notes", label: "Notes", icon: ScrollText },
] as const
type SectionId = (typeof sections)[number]["id"]

function SetPicker({
  label,
  value,
  sets,
  onChange,
}: {
  label: string
  value: string
  sets: { id: string; title: string }[]
  onChange: (value: string) => void
}) {
  if (sets.length < 2) return null
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v)
      }}
      items={sets.map((s) => ({ value: s.id, label: s.title }))}
    >
      <SelectTrigger aria-label={label} className="build-set-picker">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sets.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Tracks which section currently sits under the sticky nav. */
function useActiveSection() {
  const [active, setActive] = useState<SectionId>(sections[0].id)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const threshold = window.innerHeight * 0.3
      let current: SectionId = sections[0].id
      for (const { id } of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= threshold) current = id
      }
      // Reaching the bottom of the page always selects the last section.
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      )
        current = sections[sections.length - 1].id
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", schedule)
    return () => {
      removeEventListener("scroll", schedule)
      removeEventListener("resize", schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return active
}

/** True once the page header has scrolled above the viewport. */
function useHeaderPinned() {
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    const heading = document.querySelector(".build-heading")
    if (!heading) return
    const observer = new IntersectionObserver(([entry]) =>
      setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    )
    observer.observe(heading)
    return () => observer.disconnect()
  }, [])
  return pinned
}

function SectionNav({
  build,
  portrait,
}: {
  build: BuildSnapshot
  portrait?: string
}) {
  const active = useActiveSection()
  const pinned = useHeaderPinned()
  return (
    <nav
      className="build-nav"
      aria-label="Build sections"
      data-pinned={pinned || undefined}
    >
      {/* Reserved height keeps the links from shifting when this appears. */}
      <div className="build-nav-identity" aria-hidden={!pinned}>
        {portrait && <img src={portrait} alt="" width={44} height={44} />}
        <div>
          <strong>{build.ascendancy || build.className}</strong>
          <span>
            Level {build.level} · {build.className}
          </span>
        </div>
      </div>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
            >
              <s.icon aria-hidden="true" />
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Which equipment, weapon, skill, and tree set the page is showing. Keys
 * are absent while the build's own active set is selected, so a shared
 * build's URL only carries what the reader changed. */
export type BuildSelection = {
  items?: string
  weapons?: WeaponSet
  skills?: string
  tree?: string
}

export function BuildView({
  build,
  code,
  shared = false,
  shareAction,
  selection: controlled,
  onSelect,
}: {
  build: BuildSnapshot
  title: string
  code: string
  shared?: boolean
  shareAction?: ReactNode
  /** Provide both to own the selection (the shared page keeps it in the
   * URL); leave them out and the view keeps it locally. */
  selection?: BuildSelection
  onSelect?: (patch: BuildSelection) => void
}) {
  const [local, setLocal] = useState<BuildSelection>({})
  const selection = controlled ?? local
  const defaults: Required<BuildSelection> = {
    items: build.activeItemSet,
    weapons: "primary",
    skills: build.activeSkillSet,
    tree: String(build.activeSpec),
  }
  const select = <TKey extends keyof BuildSelection>(
    key: TKey,
    value: Required<BuildSelection>[TKey]
  ) => {
    const patch = { [key]: value === defaults[key] ? undefined : value }
    if (onSelect) onSelect(patch)
    else setLocal((prev) => ({ ...prev, ...patch }))
  }
  const itemSet = selection.items ?? defaults.items
  const weapons = selection.weapons ?? defaults.weapons
  const skillSet = selection.skills ?? defaults.skills
  const specIndex =
    selection.tree !== undefined &&
    build.treeSpecs.at(Number(selection.tree)) !== undefined
      ? selection.tree
      : defaults.tree
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState("")
  const gear =
    build.itemSets.find((s) => s.id === itemSet) ?? build.itemSets.at(0)
  const hasGear = gear?.slots.some((s) => s.itemId && s.itemId !== "0")
  const swappable = !!gear && equipmentHasSwap(gear)
  const skillSets = useMemo(() => {
    if (
      build.skillSets.every((set) =>
        set.skills.every((skill) =>
          skill.gems.every(
            (gem) =>
              gem.corrupted !== undefined &&
              gem.gemId !== undefined &&
              gem.statSetIndex !== undefined
          )
        )
      )
    )
      return build.skillSets
    try {
      return parseBuild(code).skillSets
    } catch {
      return build.skillSets
    }
  }, [build.skillSets, code])
  const skills = skillSets.find((s) => s.id === skillSet) ?? skillSets.at(0)
  // Old immutable snapshots omitted socket assignments and weapon set
  // passives; recover them from the saved export.
  const treeSpecs = useMemo(() => {
    if (
      build.treeSpecs.every(
        (spec) =>
          spec.sockets !== undefined &&
          spec.weaponSet1 !== undefined &&
          spec.attributeOverrides !== undefined
      )
    )
      return build.treeSpecs
    try {
      return parseBuild(code).treeSpecs
    } catch {
      return build.treeSpecs
    }
  }, [build, code])
  const spec = treeSpecs.at(Number(specIndex))
  const portrait =
    classPortraits[build.ascendancy] ?? classPortraits[build.className]
  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setMessage(`${kind} copied.`)
    } catch {
      setMessage("Clipboard unavailable. Download the export code below.")
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "exile-build.txt"
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <article className="build-view">
      <header className="build-heading">
        <div className="build-emblem">
          {portrait ? (
            <img src={portrait} alt="" width={84} height={84} />
          ) : (
            <Shield aria-hidden="true" />
          )}
        </div>
        <div className="build-identity">
          <h1>
            {build.ascendancy || build.className}
            {` · Level ${build.level}`}
          </h1>
          <p>
            <span>{build.className}</span>
            {spec && <span>Tree {spec.version.replaceAll("_", ".")}</span>}
          </p>
        </div>
        <div className="build-actions">
          {shareAction}
          {shared && (
            <Button
              onClick={() => copy("Link", window.location.href)}
              variant="outline"
            >
              <Link2 />
              {copied === "Link" ? "Copied" : "Share link"}
            </Button>
          )}
          <Button
            className="build-primary"
            onClick={() => copy("PoB code", code)}
          >
            {copied === "PoB code" ? <Check /> : <Copy />}
            Copy PoB code
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Download PoB export code"
            onClick={download}
          >
            <Download />
          </Button>
        </div>
      </header>
      <p className="build-copy-status" role="status">
        {message}
      </p>
      <div className="build-layout">
        <SectionNav build={build} portrait={portrait} />
        <div className="build-sections">
          <section id="equipment" className="build-section">
            <div className="build-section-heading">
              <h2>Equipment</h2>
              <div className="equipment-controls">
                <SetPicker
                  label="Equipment set"
                  sets={build.itemSets}
                  value={itemSet}
                  onChange={(v) => select("items", v)}
                />
                {swappable && (
                  <WeaponSetSwitch
                    value={weapons}
                    onChange={(v) => select("weapons", v)}
                  />
                )}
              </div>
            </div>
            <div className="build-section-body">
              <div className="build-section-main">
                {gear && hasGear ? (
                  <EquipmentDisplay
                    key={gear.id}
                    build={build}
                    gear={gear}
                    weapons={swappable ? weapons : "primary"}
                  />
                ) : (
                  <p className="build-empty">No equipment saved in this set.</p>
                )}
              </div>
              <aside
                className="build-section-aside"
                aria-label="Character stats"
              >
                <BuildStats
                  build={build}
                  groups={["character", "defensive", "recovery"]}
                  note="Saved PoB values. Missing stats are omitted; switching equipment sets does not recalculate them."
                />
              </aside>
            </div>
          </section>
          <section id="skills" className="build-section">
            <div className="build-section-heading">
              <div className="build-skills-heading">
                <h2>Skills & supports</h2>
                <GemReferenceInfo />
              </div>
              <SetPicker
                label="Skill set"
                sets={build.skillSets}
                value={skillSet}
                onChange={(v) => select("skills", v)}
              />
            </div>
            <div className="build-section-body">
              <div className="build-section-main">
                <SkillGems
                  skills={skills?.skills ?? []}
                  mainSocketGroup={
                    skillSet === build.activeSkillSet
                      ? build.mainSocketGroup
                      : 0
                  }
                />
              </div>
              <aside
                className="build-section-aside"
                aria-label="Main skill stats"
              >
                <BuildStats build={build} groups={["main"]} />
              </aside>
            </div>
          </section>
          <section id="tree" className="build-section">
            <div className="build-section-heading">
              <h2>Trees</h2>
              <SetPicker
                label="Tree specification"
                sets={build.treeSpecs.map((s, i) => ({
                  id: String(i),
                  title: s.title,
                }))}
                value={specIndex}
                onChange={(v) => select("tree", v)}
              />
            </div>
            <div className="build-section-body">
              {spec ? (
                <PassiveTree
                  ascendancy={build.ascendancy}
                  version={spec.version}
                  nodes={spec.nodes}
                  sockets={spec.sockets}
                  attributeOverrides={spec.attributeOverrides}
                  weaponSets={[spec.weaponSet1 ?? [], spec.weaponSet2 ?? []]}
                  items={build.items}
                />
              ) : (
                <p className="build-empty">
                  No passive tree saved in this export.
                </p>
              )}
            </div>
          </section>
          <section id="notes" className="build-section">
            <div className="build-section-heading">
              <h2>Notes</h2>
            </div>
            <div className="build-notes">
              {build.notes ||
                "The author did not include notes in this export."}
            </div>
          </section>
        </div>
      </div>
    </article>
  )
}
