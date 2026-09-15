import { TooltipPinScope } from "./tooltip-pins"
import type { TooltipPinOptions } from "./tooltip-pins"
import { GemReferenceInfo, SkillGems } from "./skill-gems"
import { BuildStats } from "./build-stats"
import { EquipmentDisplay, equipmentHasSwap } from "./equipment-display"
import { hasBondedModifiers } from "../../shared/bonded-modifiers"
import { useBondedModifiers } from "./item-display-settings-provider"
import { BuildJewels, JewelStats } from "./build-jewels"
import type { WeaponSet } from "./equipment-display"
import { PassiveTree } from "./passive-tree"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Check,
  Copy,
  Diamond,
  Download,
  Gem,
  Info,
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
  { id: "jewels", label: "Jewels", icon: Diamond },
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

/** Scrolls the window to a position over a fixed, short duration. The
 * browser's smooth scroll is not tunable and takes a beat too long on a
 * tall page. */
let scrollFrame = 0
function animateScroll(to: number) {
  cancelAnimationFrame(scrollFrame)
  const from = window.scrollY
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, to)
    return
  }
  const duration = 220
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    window.scrollTo(0, from + (to - from) * eased)
    if (t < 1) scrollFrame = requestAnimationFrame(step)
  }
  scrollFrame = requestAnimationFrame(step)
}
function scrollToSection(id: string, pushHistory = true) {
  const el = document.getElementById(id)
  if (!el) return
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const limit = document.documentElement.scrollHeight - window.innerHeight
  const to = Math.min(
    el.getBoundingClientRect().top + window.scrollY - margin,
    limit
  )
  if (pushHistory) history.pushState(null, "", `#${id}`)
  animateScroll(to)
}
/** Returns to the masthead and drops the section hash from the URL. */
function scrollToTop() {
  if (window.location.hash)
    history.pushState(
      null,
      "",
      window.location.pathname + window.location.search
    )
  animateScroll(0)
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

/** True once the masthead has scrolled above the viewport, so the strip
 * can cast a shadow only while it is stuck. */
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
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = "manual"
    const restore = () => {
      const id = window.location.hash.slice(1)
      if (sections.some((section) => section.id === id)) {
        scrollToSection(id, false)
      } else if (!id) {
        cancelAnimationFrame(scrollFrame)
        window.scrollTo(0, 0)
      }
    }
    const initial = requestAnimationFrame(() => {
      if (window.location.hash) restore()
    })
    window.addEventListener("popstate", restore)
    return () => {
      cancelAnimationFrame(initial)
      cancelAnimationFrame(scrollFrame)
      window.removeEventListener("popstate", restore)
      history.scrollRestoration = previous
    }
  }, [])
  return (
    <nav
      className="build-nav"
      aria-label="Build sections"
      data-pinned={pinned || undefined}
    >
      {/* The build's identity leads the strip and returns the reader to the
          masthead; the section list follows the main navigation's styling. */}
      <div className="build-nav-inner">
        <a
          href="#"
          className="build-nav-identity"
          title="Back to top"
          onClick={(event) => {
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return
            event.preventDefault()
            scrollToTop()
          }}
        >
          {portrait ? (
            <img src={portrait} alt="" width={36} height={36} />
          ) : (
            <span className="build-nav-emblem" aria-hidden="true">
              <Shield />
            </span>
          )}
          <span className="build-nav-identity-copy">
            <strong>{build.ascendancy || build.className}</strong>
            <span>
              Level {build.level} · {build.className}
            </span>
          </span>
        </a>
        <ul>
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return
                  event.preventDefault()
                  scrollToSection(s.id)
                }}
              >
                <s.icon aria-hidden="true" />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
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
  tree?: number
}

export function BuildView({
  build,
  title,
  code,
  shared = false,
  shareAction,
  selection: controlled,
  onSelect,
  pinningEnabled = true,
  maxPinnedTooltips = 1,
}: TooltipPinOptions & {
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
    tree: build.activeSpec,
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
    selection.tree !== undefined && build.treeSpecs.at(selection.tree)
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
        set.skills.every(
          (skill) =>
            skill.source !== undefined &&
            skill.removed !== undefined &&
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
  const spec = treeSpecs.at(specIndex)
  const { setAutomatic: setAutomaticBonded } = useBondedModifiers()
  const automaticBonded = hasBondedModifiers(spec, weapons)
  useEffect(() => {
    setAutomaticBonded(automaticBonded)
    return () => setAutomaticBonded(false)
  }, [automaticBonded, setAutomaticBonded])
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
    <TooltipPinScope
      key={code}
      pinningEnabled={pinningEnabled}
      maxPinnedTooltips={maxPinnedTooltips}
      resetKey={`${itemSet}:${weapons}:${skillSet}:${specIndex}`}
    >
      <article className="build-view">
        {/* The masthead follows the exchange masthead: a serif title over a
          mono meta line, closed by a rule that runs frame to frame. */}
        <header className="market-heading build-heading">
          <div className="build-emblem" aria-hidden="true">
            {portrait ? (
              <img src={portrait} alt="" width={84} height={84} />
            ) : (
              <Shield />
            )}
          </div>
          <div className="market-heading-copy build-identity">
            <h1>
              {title.trim() ||
                `${build.ascendancy || build.className} · Level ${build.level}`}
            </h1>
            <p className="market-meta">
              <span>{build.className}</span>
              {spec && <span>Tree {spec.version.replaceAll("_", ".")}</span>}
            </p>
          </div>
          <div className="build-actions">
            <span className="build-copy-status" role="status">
              {message}
            </span>
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
        <div className="build-layout">
          <SectionNav build={build} portrait={portrait} />
          <div className="build-sections">
            <section id="equipment" className="build-section">
              <header className="build-section-strip">
                <h2>Equipment</h2>
                <div className="equipment-controls">
                  <SetPicker
                    label="Equipment set"
                    sets={build.itemSets}
                    value={itemSet}
                    onChange={(v) => select("items", v)}
                  />
                </div>
              </header>
              <div className="build-section-body">
                <div className="build-section-main">
                  {gear && hasGear ? (
                    <EquipmentDisplay
                      key={gear.id}
                      build={build}
                      gear={gear}
                      treeVersion={spec?.version}
                      weapons={swappable ? weapons : "primary"}
                      onWeaponsChange={(v) => select("weapons", v)}
                    />
                  ) : (
                    <p className="build-empty">
                      No equipment saved in this set.
                    </p>
                  )}
                </div>
                <aside
                  className="build-section-aside"
                  aria-label="Character stats"
                >
                  <BuildStats
                    build={build}
                    groups={["character", "defensive", "recovery"]}
                  />
                </aside>
              </div>
            </section>
            <section id="skills" className="build-section">
              <header className="build-section-strip">
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
              </header>
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
              <header className="build-section-strip">
                <h2>Trees</h2>
                <SetPicker
                  label="Tree specification"
                  sets={build.treeSpecs.map((s, i) => ({
                    id: String(i),
                    title: s.title,
                  }))}
                  value={String(specIndex)}
                  onChange={(v) => select("tree", Number(v))}
                />
              </header>
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
                  <p className="build-section-main build-empty">
                    No passive tree saved in this export.
                  </p>
                )}
              </div>
            </section>
            <section id="jewels" className="build-section">
              <header className="build-section-strip">
                <h2>Jewels</h2>
                {build.treeSpecs.length > 1 && spec && (
                  <span className="build-strip-note">{spec.title}</span>
                )}
              </header>
              <div className="build-section-body">
                <div className="build-section-main">
                  <BuildJewels build={build} spec={spec} gear={gear} />
                </div>
                <aside className="build-section-aside" aria-label="Jewel stats">
                  <JewelStats build={build} spec={spec} gear={gear} />
                </aside>
              </div>
            </section>
            <section id="notes" className="build-section">
              <header className="build-section-strip">
                <h2>Notes</h2>
              </header>
              <div className="build-section-body build-section-full">
                <div className="build-section-main">
                  {build.notes ? (
                    <div className="build-notes">{build.notes}</div>
                  ) : (
                    <p className="build-notes build-notes-empty">
                      The author did not include notes in this export.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
        <section className="bottom-note">
          <Info size={15} aria-hidden="true" />
          <p>
            This build is a snapshot from Path of Building, not a live
            character. Character and skill stats are saved PoB values and do not
            recalculate when you browse other sets. Jewel totals reflect the
            selected tree and equipment. Artwork © Grinding Gear Games.{" "}
            <a href="/methodology">Data &amp; attribution.</a>
          </p>
        </section>
      </article>
    </TooltipPinScope>
  )
}
