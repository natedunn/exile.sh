import type { BaseReference } from "./item-registry"
import { baseStatRows } from "./item-registry"

/* A unique's own figures: its base's properties with the unique's local
 * modifiers applied, as Path of Building computes them. Flat bonuses add to
 * the base value, increases multiply the sum, and the result is rounded
 * once. Quality is left out, as a dropped unique has none. Rolled
 * modifiers give a low and a high figure. */

type Span = [number, number]

const zero = (): Span => [0, 0]

const add = (total: Span, part: Span) => {
  total[0] += part[0]
  total[1] += part[1]
}

const roll = /^\((-?[\d.]+)-(-?[\d.]+)\)$/

/* "(200-250)" or "35" as a low/high pair; "reduced" turns it negative. */
function span(text: string, negative = false): Span {
  const match = text.match(roll)
  const low = Number(match ? match[1] : text)
  const high = Number(match ? match[2] : text)
  return negative ? [-high, -low] : [low, high]
}

const N = String.raw`(\([-\d.]+-[-\d.]+\)|[-\d.]+)`

const defences = {
  Armour: ["armour"],
  "Evasion Rating": ["evasion"],
  "Energy Shield": ["energy_shield"],
  "Runic Ward": ["ward"],
  "Armour and Evasion": ["armour", "evasion"],
  "Armour and Energy Shield": ["armour", "energy_shield"],
  "Evasion and Energy Shield": ["evasion", "energy_shield"],
  "Armour, Evasion and Energy Shield": ["armour", "evasion", "energy_shield"],
} as const

type Defence = "armour" | "evasion" | "energy_shield" | "ward"

const flatDefences: Record<string, Defence> = {
  Armour: "armour",
  "Evasion Rating": "evasion",
  "maximum Energy Shield": "energy_shield",
  "maximum Runic Ward": "ward",
}

const patterns = {
  flatDefence: new RegExp(
    String.raw`^\+${N} to (Armour|Evasion Rating|maximum Energy Shield|maximum Runic Ward)$`
  ),
  incDefence: new RegExp(
    String.raw`^${N}% (increased|reduced) (${Object.keys(defences).join("|")})$`
  ),
  addedPhysical: new RegExp(String.raw`^Adds ${N} to ${N} Physical Damage$`),
  incPhysical: new RegExp(
    String.raw`^${N}% (increased|reduced) Physical Damage$`
  ),
  attackSpeed: new RegExp(String.raw`^${N}% (increased|reduced) Attack Speed$`),
  incCrit: new RegExp(
    String.raw`^${N}% (increased|reduced) Critical Hit Chance$`
  ),
  flatCrit: new RegExp(String.raw`^\+${N}% to Critical Hit Chance$`),
  incBlock: new RegExp(String.raw`^${N}% (increased|reduced) Block chance$`),
  flatBlock: new RegExp(String.raw`^\+${N}% to Block chance$`),
}

const round = (value: number, places = 0) => {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

/* Fixed places, or with `places` undefined, only the digits a value has
 * (6.25%, 6%). */
function format([low, high]: Span, places?: number, unit = "") {
  const text = (value: number) =>
    places === undefined ? String(value) : value.toFixed(places)
  return low === high
    ? `${text(low)}${unit}`
    : `${text(low)}–${text(high)}${unit}`
}

export function uniqueStatRows(
  base: BaseReference,
  modifiers: string[]
): { label: string; value: string }[] {
  const props = base.properties
  const number = (key: string) =>
    typeof props[key] === "number" ? props[key] : undefined
  const defenceBase = (key: Defence): Span | undefined => {
    const value = props[key]
    return value && typeof value === "object" && "min" in value
      ? [
          (value as { min: number; max: number }).min,
          (value as { min: number; max: number }).max,
        ]
      : undefined
  }
  // Defence modifiers are local only on armour; on jewellery they are the
  // character's. Weapon and shield modifiers likewise need their base.
  const armour = (["armour", "evasion", "energy_shield", "ward"] as const).some(
    (key) => key in props
  )
  const weapon = number("physical_damage_min") !== undefined
  const shield = number("block") !== undefined

  const flat = {
    armour: zero(),
    evasion: zero(),
    energy_shield: zero(),
    ward: zero(),
  }
  const inc = {
    armour: zero(),
    evasion: zero(),
    energy_shield: zero(),
    ward: zero(),
  }
  const addedMin = zero()
  const addedMax = zero()
  const physical = zero()
  const speed = zero()
  const critFlat = zero()
  const critInc = zero()
  const blockFlat = zero()
  const blockInc = zero()
  let noPhysical = false
  let noEnergyShield = false

  for (const text of modifiers) {
    let match
    if (armour && (match = text.match(patterns.flatDefence)))
      add(flat[flatDefences[match[2]]], span(match[1]))
    else if (armour && (match = text.match(patterns.incDefence)))
      for (const key of defences[match[3] as keyof typeof defences])
        add(inc[key], span(match[1], match[2] === "reduced"))
    else if (weapon && (match = text.match(patterns.addedPhysical))) {
      add(addedMin, span(match[1]))
      add(addedMax, span(match[2]))
    } else if (weapon && (match = text.match(patterns.incPhysical)))
      add(physical, span(match[1], match[2] === "reduced"))
    else if (weapon && (match = text.match(patterns.attackSpeed)))
      add(speed, span(match[1], match[2] === "reduced"))
    else if (weapon && (match = text.match(patterns.incCrit)))
      add(critInc, span(match[1], match[2] === "reduced"))
    else if (weapon && (match = text.match(patterns.flatCrit)))
      add(critFlat, span(match[1]))
    else if (shield && (match = text.match(patterns.incBlock)))
      add(blockInc, span(match[1], match[2] === "reduced"))
    else if (shield && (match = text.match(patterns.flatBlock)))
      add(blockFlat, span(match[1]))
    else if (weapon && text === "No Physical Damage") noPhysical = true
    else if (armour && text === "Cannot have Energy Shield")
      noEnergyShield = true
  }

  const values = new Map<string, string>()
  const added: { label: string; value: string }[] = []
  const labels: Record<Defence, string> = {
    armour: "Armour",
    evasion: "Evasion rating",
    energy_shield: "Energy shield",
    ward: "Runic Ward",
  }
  for (const key of Object.keys(labels) as Defence[]) {
    const [baseLow, baseHigh] = defenceBase(key) ?? [0, 0]
    if (!defenceBase(key) && flat[key][1] === 0) continue
    const result: Span =
      key === "energy_shield" && noEnergyShield
        ? [0, 0]
        : [
            round((baseLow + flat[key][0]) * (1 + inc[key][0] / 100)),
            round((baseHigh + flat[key][1]) * (1 + inc[key][1] / 100)),
          ]
    if (defenceBase(key)) values.set(labels[key], format(result))
    else added.push({ label: labels[key], value: format(result) })
  }

  const physicalMin = number("physical_damage_min")
  const physicalMax = number("physical_damage_max")
  if (physicalMin !== undefined && physicalMax !== undefined) {
    const scale = (value: number, extra: number, increase: number) =>
      noPhysical ? 0 : round((value + extra) * (1 + increase / 100))
    const low: Span = [
      scale(physicalMin, addedMin[0], physical[0]),
      scale(physicalMin, addedMin[1], physical[1]),
    ]
    const high: Span = [
      scale(physicalMax, addedMax[0], physical[0]),
      scale(physicalMax, addedMax[1], physical[1]),
    ]
    values.set(
      "Physical damage",
      low[0] === low[1] && high[0] === high[1]
        ? `${low[0]}–${high[0]}`
        : `(${format(low)}) to (${format(high)})`
    )
  }
  const attackTime = number("attack_time")
  if (attackTime && attackTime > 0) {
    const rate = 1000 / attackTime
    values.set(
      "Attacks per second",
      format(
        [
          round(rate * (1 + speed[0] / 100), 2),
          round(rate * (1 + speed[1] / 100), 2),
        ],
        2
      )
    )
  }
  const crit = number("critical_strike_chance")
  if (crit !== undefined) {
    const chance = crit / 100
    values.set(
      "Critical hit chance",
      format(
        [
          round((chance + critFlat[0]) * (1 + critInc[0] / 100), 2),
          round((chance + critFlat[1]) * (1 + critInc[1] / 100), 2),
        ],
        undefined,
        "%"
      )
    )
  }
  const block = number("block")
  if (block !== undefined)
    values.set(
      "Block chance",
      format(
        [
          Math.floor((block + blockFlat[0]) * (1 + blockInc[0] / 100)),
          Math.floor((block + blockFlat[1]) * (1 + blockInc[1] / 100)),
        ],
        0,
        "%"
      )
    )

  const rows = baseStatRows(base).map((row) =>
    values.has(row.label) ? { ...row, value: values.get(row.label)! } : row
  )
  // A defence the base lacks but the unique grants follows the others.
  const defenceLabels: string[] = Object.values(labels)
  let after = 0
  rows.forEach((row, index) => {
    if (defenceLabels.includes(row.label)) after = index
  })
  rows.splice(after + 1, 0, ...added)
  return rows
}
