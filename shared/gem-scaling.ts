import type { GemEffects, GemHeaderLevel } from "./gems"

/** One level's value. A range (e.g. "Deals 8 to 12 Fire Damage") plots its
 * average and keeps both ends for the band and tooltip. */
export type ScalingPoint = { value: number; low?: number; high?: number }
export type ScalingSeries = {
  key: string
  label: string
  /** Index 0 is gem level 1. Null where the value does not exist. */
  points: (ScalingPoint | null)[]
}
export type ScalingChart = {
  id: string
  title: string
  /** Appended to every value, e.g. "%" or " Mana". */
  unit: string
  series: ScalingSeries[]
}
export type GemScaling = {
  /** Highest level with data, so the chart can offer levels past 20. */
  maxLevel: number
  charts: ScalingChart[]
  /** Properties that hold one value at every level, named once instead of
   * drawn as a flat line. */
  unchanged: { label: string; value: string }[]
}

/** A palette validated for these charts: three series at most, all pairs. */
export const SCALING_SERIES_LIMIT = 3

type Levels = Partial<Record<string, GemHeaderLevel>>

/** Attack damage as a percentage of base. PoB omits a multiplier of 1, so a
 * level without one deals 100%. A stat set's own multiplier replaces the
 * skill's at that level (CalcActiveSkill.lua merges set level keys over the
 * skill level). Undefined when the level has no data. */
export function attackDamagePercent(
  levels: Levels,
  setMultipliers: Record<string, Record<string, number>> | null,
  level: number,
  setId?: string
) {
  const levelData = levels[String(level)]
  const override =
    setId === undefined ? undefined : setMultipliers?.[setId]?.[String(level)]
  if (override === undefined && !levelData) return undefined
  return Math.round((override ?? levelData?.baseMultiplier ?? 1) * 100)
}

const NUMBER = /\d+(?:\.\d+)?/g
const DAMAGE = /^Deals # to # (.+) Damage$/i

function varies(points: (ScalingPoint | null)[]) {
  const values = points.flatMap((point) => (point ? [point.value] : []))
  return values.some((value) => value !== values[0])
}

/** Sets that scale identically become one series. Labels name the parts it
 * covers (none when it covers every part) and the damage type, if any. */
function mergeSeries(
  entries: {
    key: string
    part: string
    type?: string
    points: (ScalingPoint | null)[]
  }[],
  partCount: number,
  fallback: string
): ScalingSeries[] {
  const merged: {
    key: string
    parts: string[]
    type?: string
    points: (ScalingPoint | null)[]
  }[] = []
  for (const entry of entries) {
    const same = merged.find(
      (other) =>
        other.type === entry.type &&
        JSON.stringify(other.points) === JSON.stringify(entry.points)
    )
    if (same) same.parts.push(entry.part)
    else merged.push({ ...entry, parts: [entry.part] })
  }
  const types = new Set(merged.map((entry) => entry.type)).size
  return merged.map(({ key, parts, type, points }) => {
    const partLabel =
      partCount > 1 && parts.length < partCount ? parts.join(" · ") : ""
    const typeLabel = type && (types > 1 || !partLabel) ? type : ""
    return {
      key,
      label:
        [partLabel, typeLabel].filter(Boolean).join(" · ") ||
        (merged.length === 1 ? fallback : parts.join(" · ")),
      points,
    }
  })
}

/** Charts past the palette's limit continue as further charts rather than
 * borrowing an unvalidated colour. */
function splitChart(chart: ScalingChart): ScalingChart[] {
  if (chart.series.length <= SCALING_SERIES_LIMIT) return [chart]
  const parts: ScalingChart[] = []
  for (let i = 0; i < chart.series.length; i += SCALING_SERIES_LIMIT)
    parts.push({
      ...chart,
      id: `${chart.id}-${parts.length + 1}`,
      series: chart.series.slice(i, i + SCALING_SERIES_LIMIT),
    })
  return parts
}

/** Everything about a skill gem that changes with its level, ready to plot.
 * Values come from the same data the page shows: header levels, per-set
 * multipliers and the generated effect text at 0% quality. */
export function gemScaling({
  attack,
  levels,
  setMultipliers,
  effects,
}: {
  attack: boolean
  levels: Levels
  setMultipliers: Record<string, Record<string, number>> | null
  effects: GemEffects | undefined
}): GemScaling {
  const effectLevels = Object.values(effects?.sets ?? {}).flatMap((set) =>
    Object.keys(set.levels).map(Number)
  )
  const maxLevel = Math.max(
    0,
    ...Object.keys(levels).map(Number),
    ...effectLevels
  )
  const range = Array.from({ length: maxLevel }, (_, index) => index + 1)
  const sets = Object.entries(effects?.sets ?? {}).sort(
    ([left], [right]) => Number(left) - Number(right)
  )
  const multipleSets = sets.length > 1
  const charts: ScalingChart[] = []
  const unchanged: GemScaling["unchanged"] = []

  // Attack damage, one series per set when per-set multipliers exist.
  if (attack) {
    const damageSets =
      multipleSets && setMultipliers !== null
        ? sets.map(([id, set]) => ({ id, label: set.label || `Part ${id}` }))
        : [{ id: undefined, label: "Attack damage" }]
    const series = mergeSeries(
      damageSets.map(({ id, label }) => ({
        key: `attack-damage-${id ?? "skill"}`,
        part: label,
        points: range.map((level) => {
          const value = attackDamagePercent(levels, setMultipliers, level, id)
          return value === undefined ? null : { value }
        }),
      })),
      damageSets.length,
      "Attack damage"
    )
    if (series.some((entry) => varies(entry.points)))
      charts.push({
        id: "attack-damage",
        title: "Attack damage",
        unit: "% of base",
        series,
      })
  }

  // Numbers in effect lines. Lines are matched by their wording with the
  // numbers removed, so a line keeps its identity as its values change.
  type Slot = {
    title: string
    unit: string
    chart: string
    part: string
    type?: string
    points: (ScalingPoint | null)[]
  }
  const slots = new Map<string, Slot>()
  for (const [setId, set] of sets) {
    const setLabel = set.label || `Part ${setId}`
    const byTemplate = new Map<string, (number[] | null)[]>()
    // Levels can be missing from a set.
    const setLevels: Partial<Record<string, { lines: string[] }>> = set.levels
    for (const level of range) {
      const seen = new Set<string>()
      for (const line of setLevels[String(level)]?.lines ?? []) {
        const text = line.replace(/\s+/g, " ").trim()
        const template = text.replace(NUMBER, "#")
        if (!template.includes("#") || seen.has(template)) continue
        seen.add(template)
        const values = (text.match(NUMBER) ?? []).map(Number)
        const rows =
          byTemplate.get(template) ??
          (byTemplate.set(template, Array(maxLevel).fill(null)),
          byTemplate.get(template)!)
        rows[level - 1] = values
      }
    }
    for (const [template, rows] of byTemplate) {
      const present = rows.filter((row): row is number[] => row !== null)
      const width = present[0]?.length ?? 0
      const changing = Array.from({ length: width }, (_, index) =>
        present.some((row) => row[index] !== present[0][index])
      )
      if (!changing.some(Boolean)) continue
      const damage = DAMAGE.exec(template)
      const isRange = /# to #/.test(template) && width === 2
      if (!isRange && changing.filter(Boolean).length > 1) continue
      const index = isRange ? 0 : changing.indexOf(true)
      // Constant numbers stay in the title; the changing one reads "#".
      let position = -1
      const title = damage
        ? "Damage per hit"
        : template.replace(/#/g, () => {
            position += 1
            return isRange || position === index
              ? "#"
              : String(present[0][position])
          })
      // The words after the changing number give its unit.
      const after = template.split("#")[index + 1] ?? ""
      const unit = after.startsWith("%")
        ? "%"
        : /^ metres?\b/.test(after)
          ? " m"
          : /^ seconds?\b/.test(after)
            ? " s"
            : ""
      const chart = damage ? `damage:${damage[1]}` : `effect:${title}`
      const key = `${chart}:${setId}`
      slots.set(key, {
        title,
        unit: isRange ? "" : unit,
        chart: damage ? "damage" : chart,
        part: setLabel,
        type: damage ? `${damage[1]} damage` : undefined,
        points: rows.map((row) =>
          row === null
            ? null
            : isRange
              ? { value: (row[0] + row[1]) / 2, low: row[0], high: row[1] }
              : { value: row[index] }
        ),
      })
    }
  }
  const grouped = new Map<string, Slot[]>()
  for (const slot of slots.values())
    grouped.set(slot.chart, [...(grouped.get(slot.chart) ?? []), slot])
  // Damage leads, then effect lines in the order they first appear.
  for (const [chartId, entries] of [...grouped].sort(([left], [right]) =>
    left === "damage" ? -1 : right === "damage" ? 1 : 0
  )) {
    const series = mergeSeries(
      entries.map((entry, index) => ({
        key: `${chartId}-${index}`,
        part: entry.part,
        type: entry.type,
        points: entry.points,
      })),
      sets.length,
      entries[0].title
    )
    charts.push({
      id: chartId,
      title: entries[0].title,
      unit: entries[0].unit,
      series,
    })
  }

  // Header properties that scale: cost, attack speed, critical hit chance.
  const property = (
    id: string,
    title: string,
    unit: string,
    read: (level: GemHeaderLevel) => number | undefined
  ) => {
    const points = range.map((level) => {
      const data = levels[String(level)]
      const value = data ? read(data) : undefined
      return value === undefined ? null : { value }
    })
    const first = points.find(Boolean)
    if (!first) return
    if (varies(points))
      charts.push({
        id,
        title,
        unit,
        series: [{ key: id, label: title, points }],
      })
    else unchanged.push({ label: title, value: `${first.value}${unit}` })
  }
  const resources = Object.keys(levels["1"]?.cost ?? {})
  for (const resource of resources) {
    // "ManaPerMinute" reads as "Mana per minute".
    const name = resource
      .replace(/(?<=[a-z])(?=[A-Z])/g, " ")
      .replace(/ (\w)/g, (_, letter: string) => ` ${letter.toLowerCase()}`)
    property(
      `cost-${resource}`,
      resources.length > 1 ? `${name} cost` : "Cost",
      ` ${name}`,
      (level) => level.cost?.[resource]
    )
  }
  if (levels["1"]?.attackSpeedMultiplier !== undefined)
    property("attack-speed", "Attack speed", "% of base", (level) =>
      level.attackSpeedMultiplier === undefined
        ? undefined
        : 100 + level.attackSpeedMultiplier
    )
  if (levels["1"]?.critChance !== undefined)
    property(
      "crit-chance",
      "Critical hit chance",
      "%",
      (level) => level.critChance
    )

  return { maxLevel, charts: charts.flatMap(splitChart), unchanged }
}
