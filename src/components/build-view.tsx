import { GemReferenceInfo, SkillGems } from "./skill-gems"
import { BuildStats } from "./build-stats"
import { EquipmentDisplay } from "./equipment-display"
import { PassiveTree } from "./passive-tree"
import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Check, Copy, Download, Link2 } from "lucide-react"
import { Button } from "./ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { displayStat, parseBuild } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

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
export function BuildView({
  build,
  code,
  shared = false,
  shareAction,
}: {
  build: BuildSnapshot
  title: string
  code: string
  shared?: boolean
  shareAction?: ReactNode
}) {
  const [tab, setTab] = useState("equipment")
  const [itemSet, setItemSet] = useState(build.activeItemSet)
  const [skillSet, setSkillSet] = useState(build.activeSkillSet)
  const [specIndex, setSpecIndex] = useState(String(build.activeSpec))
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState("")
  const gear =
    build.itemSets.find((s) => s.id === itemSet) ?? build.itemSets.at(0)
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
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="build-tabs"
      >
        <TabsList variant="line">
          {["equipment", "skills", "tree", "configuration", "notes"].map(
            (t) => (
              <TabsTrigger key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </TabsTrigger>
            )
          )}
        </TabsList>
        <TabsContent value="equipment">
          <div className="build-equipment-overview">
            <div className="build-equipment-column">
              {gear?.slots.some((s) => s.itemId && s.itemId !== "0") ? (
                <EquipmentDisplay
                  key={gear.id}
                  build={build}
                  gear={gear}
                  setPicker={
                    <SetPicker
                      label="Equipment set"
                      sets={build.itemSets}
                      value={itemSet}
                      onChange={setItemSet}
                    />
                  }
                />
              ) : (
                <>
                  <div className="build-section-heading">
                    <h2>Equipment</h2>
                    <SetPicker
                      label="Equipment set"
                      sets={build.itemSets}
                      value={itemSet}
                      onChange={setItemSet}
                    />
                  </div>
                  <p className="build-empty">No equipment saved in this set.</p>
                </>
              )}
            </div>
            <BuildStats build={build} />
          </div>
        </TabsContent>
        <TabsContent value="skills">
          <div className="build-section-heading">
            <div className="build-skills-heading">
              <h2>Skills & supports</h2>
              <GemReferenceInfo />
            </div>
            <SetPicker
              label="Skill set"
              sets={build.skillSets}
              value={skillSet}
              onChange={setSkillSet}
            />
          </div>
          <SkillGems
            skills={skills?.skills ?? []}
            mainSocketGroup={
              skillSet === build.activeSkillSet ? build.mainSocketGroup : 0
            }
          />
        </TabsContent>
        <TabsContent value="tree">
          <div className="build-section-heading">
            <h2>Passive tree</h2>
            <SetPicker
              label="Tree specification"
              sets={build.treeSpecs.map((s, i) => ({
                id: String(i),
                title: s.title,
              }))}
              value={specIndex}
              onChange={setSpecIndex}
            />
          </div>
          {spec ? (
            <>
              <p className="build-muted">
                {spec.nodes.length} saved node IDs · Tree version{" "}
                {spec.version.replaceAll("_", ".")} · {spec.title}
              </p>
              <PassiveTree
                ascendancy={build.ascendancy}
                version={spec.version}
                nodes={spec.nodes}
                sockets={spec.sockets}
                attributeOverrides={spec.attributeOverrides}
                weaponSets={[spec.weaponSet1 ?? [], spec.weaponSet2 ?? []]}
                items={build.items}
              />
              <p className="build-muted">
                All saved tree specifications are preserved in the PoB code.
              </p>
            </>
          ) : (
            <p className="build-empty">No passive tree saved in this export.</p>
          )}
        </TabsContent>
        <TabsContent value="configuration">
          <div className="build-section-heading">
            <h2>Snapshot configuration</h2>
          </div>
          <p className="build-muted">
            These inputs came from the export. They may include custom modifiers
            and optimistic conditions. Stats are not independently verified.
          </p>
          {build.configSets.map((set) => (
            <section className="build-config" key={set.id}>
              <h3>
                {set.title}
                {set.id === build.activeConfigSet ? " · Active in PoB" : ""}
              </h3>
              {set.inputs.length ? (
                <dl>
                  {set.inputs.map((input, i) => (
                    <div key={i}>
                      <dt>{input.name.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                      <dd>{input.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>No explicit configuration inputs.</p>
              )}
            </section>
          ))}
          <div className="build-section-heading">
            <h2>Exported stats</h2>
          </div>
          <dl className="build-all-stats">
            {build.stats.map((s, i) => (
              <div key={i}>
                <dt>{s.name}</dt>
                <dd>{displayStat(s.value)}</dd>
              </div>
            ))}
          </dl>
          {build.minionStats.length > 0 && (
            <>
              <h3>Minion stats</h3>
              <dl className="build-all-stats">
                {build.minionStats.map((s, i) => (
                  <div key={i}>
                    <dt>{s.name}</dt>
                    <dd>{displayStat(s.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </TabsContent>
        <TabsContent value="notes">
          <div className="build-section-heading">
            <h2>Build notes</h2>
          </div>
          <div className="build-notes">
            {build.notes || "The author did not include notes in this export."}
          </div>
        </TabsContent>
      </Tabs>
    </article>
  )
}
