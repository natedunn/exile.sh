import { TooltipPinScope } from "./tooltip-pins"
import type { TooltipPinOptions } from "./tooltip-pins"
import { SkillGems } from "./skill-gems"
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
  ArrowUp,
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
import { EmptyState } from "./ui/empty-state"
import { LabelText } from "./ui/label"
import { Note } from "./ui/note"
import {
  PageHeading,
  PageHeadingCopy,
  PageMeta,
  PageTitle,
} from "./ui/page-heading"
import { BuildPrimaryButton } from "./build/primary-button"
import {
  BuildSection,
  BuildSectionAside,
  BuildSectionBody,
  BuildSectionMain,
  BuildSectionStrip,
  BuildSectionTitle,
  buildNavHeightClass,
} from "./build/section"
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
import { ItemTreeVersionProvider } from "./item-reference-tooltip"
import { cn } from "cn"

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
      <SelectTrigger aria-label={label} className="max-w-65">
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
/** One document-pixel stop for anchor scrolling and the nav identity reveal.
 * Round down once so landing on a fractional layout boundary never leaves
 * the reveal waiting for another scroll pixel. */
function sectionScrollTarget(el: HTMLElement) {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const limit = document.documentElement.scrollHeight - window.innerHeight
  return Math.max(
    0,
    Math.floor(
      Math.min(el.getBoundingClientRect().top + window.scrollY - margin, limit)
    )
  )
}
function scrollToSection(id: string, pushHistory = true) {
  const el = document.getElementById(id)
  if (!el) return
  const to = sectionScrollTarget(el)
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

/** The identity is visible at or below Equipment's document-pixel stop,
 * independently of CSS sticky state or the heading's visibility. */
function useHeaderPinned() {
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    const equipment = document.getElementById("equipment")
    if (!equipment) return
    let frame = 0
    const update = () => {
      frame = 0
      const threshold = sectionScrollTarget(equipment)
      // Some zoom levels expose a fractional scrollY for an integer target.
      setPinned(Math.ceil(window.scrollY) >= threshold)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const sizes = new ResizeObserver(schedule)
    sizes.observe(equipment)
    const heading = document.querySelector("[data-slot='page-heading']")
    if (heading) sizes.observe(heading)
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    update()
    return () => {
      sizes.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      if (frame) cancelAnimationFrame(frame)
    }
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
      className={cn(
        "group/nav sticky top-0 z-5 min-w-0 border-b border-rule-strong bg-paper transition-shadow duration-220 ease-out",
        buildNavHeightClass,
        /* Only the stuck navigation sits above tooltip layers; modal views
           cover the page, including its otherwise raised navigation. */
        "data-pinned:z-60 data-pinned:shadow-nav-pinned [body:has([data-slot=dialog-content][data-open])_&]:z-5!"
      )}
      aria-label="Build sections"
      data-pinned={pinned || undefined}
    >
      {/* The build's identity leads the strip and returns the reader to the
          masthead; the section list follows the main navigation's styling. */}
      <div className="flex h-full items-center px-[var(--shell-gutter)] transition-[padding-left] duration-320 ease-out group-data-pinned/nav:pl-0 motion-reduce:transition-none">
        <div
          data-testid="build-nav-identity-reveal"
          className="grid h-full shrink-0 [transform:translateX(-18px)] grid-cols-[0fr] opacity-0 transition-[grid-template-columns,margin-right,opacity,transform] [transition-duration:320ms,320ms,220ms,320ms] ease-out group-data-pinned/nav:mr-8 group-data-pinned/nav:[transform:translateX(0)] group-data-pinned/nav:grid-cols-[1fr] group-data-pinned/nav:opacity-100 motion-reduce:transition-none max-lg:group-data-pinned/nav:mr-4"
          inert={!pinned}
          aria-hidden={!pinned}
        >
          <div className="min-w-0 overflow-hidden">
            {/* The identity closes with a hairline before the list, like the
                frame's dividers, and the whole block is the link back to the
                top. */}
            <a
              href="#"
              className="group/identity relative isolate flex h-full w-max max-w-75 min-w-0 shrink-0 items-center gap-3 overflow-hidden border-r border-rule-strong pr-4 pl-[min(var(--shell-gutter),16px)] text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus max-lg:max-w-55 max-sm:pr-3"
              title="Back to top"
              aria-label="Go to top"
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
                <img
                  src={portrait}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full border border-rule-strong bg-surface object-cover"
                />
              ) : (
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-rule-strong bg-surface text-brand [&>svg]:size-4"
                  aria-hidden="true"
                >
                  <Shield />
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5 max-sm:hidden">
                <strong className="truncate text-sm font-medium text-ink">
                  {build.ascendancy || build.className}
                </strong>
                <span className="truncate font-mono text-label text-ink-muted">
                  Level {build.level} · {build.className}
                </span>
              </span>
              {/* Native-size dither cells form the rising edge and texture
                  the bronze fill. */}
              <span
                className="pointer-events-none absolute inset-0 z-1 flex [transform:translateY(calc(100%+48px))] items-center justify-center gap-2.5 bg-brand text-sm leading-[1.2] font-semibold text-paper transition-transform duration-380 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/identity:[transform:translateY(0)] group-focus-visible/identity:[transform:translateY(0)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-12 before:h-12 before:rotate-180 before:bg-brand before:[mask-image:var(--dither-fade-y)] before:[mask-size:auto] before:[mask-position:center] before:[mask-repeat:repeat-x] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-scrim/20 after:[mask-image:var(--dither-fade-y)] after:[mask-size:auto] after:[mask-position:center] after:[mask-repeat:repeat-x] after:content-[''] motion-reduce:transition-none max-sm:gap-0 [&>*]:relative [&>*]:z-1 [&>svg]:size-4.5 [&>svg]:shrink-0"
                aria-hidden="true"
              >
                <ArrowUp />
                <span className="max-sm:hidden">Go to top</span>
              </span>
            </a>
          </div>
        </div>
        {/* The list is the main navigation's: mono capitals with a bronze
            underline on the current section. */}
        <ul className="m-0 flex h-full min-w-0 [scrollbar-width:none] list-none items-center gap-6 overflow-x-auto p-0 mono-label max-lg:gap-4 max-sm:gap-3 [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <li key={s.id} className="h-full shrink-0">
              <a
                href={`#${s.id}`}
                className="-mb-px flex h-full items-center gap-2 border-b-2 border-transparent whitespace-nowrap text-ink-muted no-underline transition-[color,border-color] duration-120 hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus aria-[current]:border-brand aria-[current]:text-ink [&>svg]:block [&>svg]:size-[15px] [&>svg]:shrink-0 [&>svg]:transition-colors [&>svg]:duration-120 aria-[current]:[&>svg]:text-brand max-sm:[&>svg]:hidden"
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
      <article className="min-w-0">
        {/* The masthead follows the exchange masthead: a serif title over a
          mono meta line, closed by a rule that runs frame to frame. */}
        <PageHeading className="-mx-[var(--shell-gutter)] min-h-0 items-center gap-8 px-[var(--shell-gutter)] py-8 max-sm:flex-wrap max-sm:gap-4 max-sm:py-6">
          {/* The class emblem under a dithered bronze glow. The glow is used
              at its native 640px so the cells stay crisp; the masthead clips
              whatever spills past the frame. */}
          <div
            className="relative z-1 grid size-21 shrink-0 place-items-center rounded-full border border-rule-strong bg-surface text-brand before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:-z-1 before:size-160 before:-translate-x-1/2 before:-translate-y-1/2 before:bg-brand before:[mask-image:var(--dither-glow)] before:[mask-size:auto] before:[mask-position:center] before:[mask-repeat:no-repeat] before:opacity-8 before:content-[''] max-sm:size-14 [&>svg]:size-8 max-sm:[&>svg]:size-6"
            aria-hidden="true"
          >
            {portrait ? (
              <img
                src={portrait}
                alt=""
                width={84}
                height={84}
                className="size-full rounded-full object-cover"
              />
            ) : (
              <Shield />
            )}
          </div>
          <PageHeadingCopy className="flex-1" data-testid="build-identity">
            <PageTitle className="text-5xl whitespace-normal max-sm:text-4xl">
              {title.trim() ||
                `${build.ascendancy || build.className} · Level ${build.level}`}
            </PageTitle>
            <PageMeta>
              <span>{build.className}</span>
              {spec && <span>Tree {spec.version.replaceAll("_", ".")}</span>}
            </PageMeta>
          </PageHeadingCopy>
          <div className="relative z-1 flex flex-wrap items-center justify-end gap-2 max-sm:basis-full max-sm:justify-start [&_[data-slot=button]]:border-rule-strong">
            {/* Clipboard feedback sits in the row with the buttons, so
                nothing moves. */}
            <span
              className="mr-2 mono-label tracking-label-tight text-brand empty:hidden max-sm:order-1 max-sm:m-0 max-sm:basis-full"
              role="status"
            >
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
            <BuildPrimaryButton onClick={() => copy("PoB code", code)}>
              {copied === "PoB code" ? <Check /> : <Copy />}
              Copy PoB code
            </BuildPrimaryButton>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Download PoB export code"
              onClick={download}
            >
              <Download />
            </Button>
          </div>
        </PageHeading>
        {/* A section strip runs under the masthead and sticks to the top of
            the viewport; the sections stack below at full width. */}
        <div className="relative -mx-[var(--shell-gutter)] min-w-0">
          <SectionNav build={build} portrait={portrait} />
          <div className="min-w-0">
            <BuildSection id="equipment">
              <BuildSectionStrip>
                <BuildSectionTitle>Equipment</BuildSectionTitle>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <SetPicker
                    label="Equipment set"
                    sets={build.itemSets}
                    value={itemSet}
                    onChange={(v) => select("items", v)}
                  />
                </div>
              </BuildSectionStrip>
              <BuildSectionBody>
                {/* The board frame sits flush in its cell, its rule closing
                    it from the frame edge to the figures divider. With
                    nothing after the board, the frame runs the full height
                    of the section beside the figures. Everything after it
                    takes the cell's usual padding. */}
                <BuildSectionMain className="flex flex-col self-stretch p-0 pb-8 has-[>div:not([data-slot])>div:last-child]:pb-0 [&>div:not([data-slot])]:m-0 [&>div:not([data-slot])]:flex [&>div:not([data-slot])]:flex-1 [&>div:not([data-slot])]:flex-col [&>div:not([data-slot])>div:last-child]:flex-1 [&>div:not([data-slot])>div:last-child]:border-b-0 [&>div:not([data-slot])>section]:mt-8 [&>div:not([data-slot])>section]:mr-6 [&>div:not([data-slot])>section]:ml-[var(--shell-gutter)] max-lg:[&>div:not([data-slot])>section]:mx-[var(--shell-gutter)]">
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
                    <EmptyState
                      frame="dashed"
                      className="mt-6 mr-6 mb-0 ml-[var(--shell-gutter)] max-lg:mx-[var(--shell-gutter)]"
                    >
                      No equipment saved in this set.
                    </EmptyState>
                  )}
                </BuildSectionMain>
                <BuildSectionAside aria-label="Character stats">
                  <BuildStats
                    build={build}
                    groups={["character", "defensive", "recovery"]}
                    gear={gear}
                    weapons={swappable ? weapons : "primary"}
                  />
                </BuildSectionAside>
              </BuildSectionBody>
            </BuildSection>
            <BuildSection id="skills">
              <BuildSectionStrip>
                <div className="flex items-center gap-2">
                  <BuildSectionTitle>Skills & supports</BuildSectionTitle>
                </div>
                <SetPicker
                  label="Skill set"
                  sets={build.skillSets}
                  value={skillSet}
                  onChange={(v) => select("skills", v)}
                />
              </BuildSectionStrip>
              <BuildSectionBody>
                <BuildSectionMain>
                  <SkillGems
                    skills={skills?.skills ?? []}
                    mainSocketGroup={
                      skillSet === build.activeSkillSet
                        ? build.mainSocketGroup
                        : 0
                    }
                  />
                </BuildSectionMain>
                <BuildSectionAside aria-label="Main skill stats">
                  <BuildStats build={build} groups={["main"]} />
                </BuildSectionAside>
              </BuildSectionBody>
            </BuildSection>
            <BuildSection id="tree">
              <BuildSectionStrip>
                <BuildSectionTitle>Trees</BuildSectionTitle>
                <SetPicker
                  label="Tree specification"
                  sets={build.treeSpecs.map((s, i) => ({
                    id: String(i),
                    title: s.title,
                  }))}
                  value={String(specIndex)}
                  onChange={(v) => select("tree", Number(v))}
                />
              </BuildSectionStrip>
              <BuildSectionBody>
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
                  <BuildSectionMain>
                    <EmptyState frame="dashed" className="my-0">
                      No passive tree saved in this export.
                    </EmptyState>
                  </BuildSectionMain>
                )}
              </BuildSectionBody>
            </BuildSection>
            <BuildSection id="jewels">
              <BuildSectionStrip>
                <BuildSectionTitle>Jewels</BuildSectionTitle>
                {build.treeSpecs.length > 1 && spec && (
                  <LabelText className="block truncate">{spec.title}</LabelText>
                )}
              </BuildSectionStrip>
              <ItemTreeVersionProvider value={spec?.version}>
                <BuildSectionBody>
                  <BuildSectionMain>
                    <BuildJewels build={build} spec={spec} gear={gear} />
                  </BuildSectionMain>
                  <BuildSectionAside aria-label="Jewel stats">
                    <JewelStats build={build} spec={spec} gear={gear} />
                  </BuildSectionAside>
                </BuildSectionBody>
              </ItemTreeVersionProvider>
            </BuildSection>
            <BuildSection id="notes">
              <BuildSectionStrip>
                <BuildSectionTitle>Notes</BuildSectionTitle>
              </BuildSectionStrip>
              <BuildSectionBody full>
                <BuildSectionMain full>
                  {build.notes ? (
                    <div className="max-w-[80ch] leading-[1.8] [overflow-wrap:anywhere] whitespace-pre-wrap">
                      {build.notes}
                    </div>
                  ) : (
                    <p className="max-w-[80ch] leading-[1.8] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink-muted">
                      The author did not include notes in this export.
                    </p>
                  )}
                </BuildSectionMain>
              </BuildSectionBody>
            </BuildSection>
          </div>
        </div>
        <Note
          rule="top"
          className="-mx-[var(--shell-gutter)] px-[var(--shell-gutter)] [&_a]:border-b [&_a]:border-dotted [&_a]:border-brand-deep [&_a]:text-brand-ink [&>svg]:shrink-0 [&>svg]:text-brand"
        >
          <Info size={15} aria-hidden="true" />
          <span>
            This build is a snapshot from Path of Building, not a live
            character. Character and skill stats are saved PoB values and do not
            recalculate when you browse other sets. Jewel totals reflect the
            selected tree and equipment. Artwork © Grinding Gear Games.{" "}
            <a href="/methodology">Data &amp; attribution.</a>
          </span>
        </Note>
      </article>
    </TooltipPinScope>
  )
}
