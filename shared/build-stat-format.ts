import { displayStat } from "./pob"

const labels: Record<string, string> = {
  Str: "Strength",
  Dex: "Dexterity",
  Int: "Intelligence",
  LootRarity: "Item rarity",
  Speed: "Attack / cast rate",
  HitSpeed: "Hit rate",
  TotalEHP: "Effective health pool",
  CombinedDPS: "Combined DPS",
  FullDPS: "Full DPS",
  TotalDot: "Damage over time DPS",
  TotalDotDPS: "Total damage over time DPS",
  ESCost: "Energy shield cost",
  ESPerSecondCost: "Energy shield cost per second",
  EffectiveMovementSpeedMod: "Movement speed",
}
const percentages = new Set([
  "LootRarity",
  "CritChance",
  "PreEffectiveCritChance",
  "HitChance",
  "PhysicalDamageReduction",
  "EvadeChance",
  "EffectiveBlockChance",
  "EffectiveSpellBlockChance",
  "AttackDodgeChance",
  "SpellDodgeChance",
  "EffectiveSpellSuppressionChance",
  "DeflectChance",
  "MeleeEvadeChance",
  "ProjectileEvadeChance",
  "SpellEvadeChance",
  "SpellProjectileEvadeChance",
  ...["Fire", "Cold", "Lightning", "Chaos"].flatMap((element) => [
    `${element}Resist`,
    `${element}ResistOverCap`,
  ]),
])

export function statLabel(name: string) {
  return (
    labels[name] ??
    name
      .replace(/^Spec:/, "Passive tree: ")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .replace(/\bDot\b/g, "damage over time")
      .replace(/\bES\b/g, "Energy shield")
      .replace(/\bInc\b/g, "increase")
  )
}

export function formattedStat(name: string, value: string) {
  const scaled = name === "EffectiveMovementSpeedMod"
  const formatted = displayStat(
    scaled && value !== "" ? String(Number(value) * 100) : value
  )
  if (formatted === "—") return formatted
  const perSecond = /PerSecondCost$/.test(name)
  const suffix =
    scaled || percentages.has(name) || /Percent|^Spec:.*Inc$/.test(name)
      ? "%"
      : name === "CritMultiplier"
        ? "×"
        : /RegenRecovery$|LeechGainRate$/.test(name) ||
            ["Speed", "HitSpeed", "EnergyShieldRecharge"].includes(name)
          ? "/s"
          : /Cooldown$|RechargeDelay$|ChannelTime$|TimeMaxSeals$/.test(name)
            ? " s"
            : /Metres$/.test(name)
              ? " m"
              : ""
  return formatted + suffix + (perSecond ? "/s" : "")
}

export function statCategory(name: string) {
  if (/Regen|Leech|Recharge|Recovery/.test(name)) return "Recovery"
  if (name === "PhysicalDamageReduction") return "Defences & resources"
  if (
    /DPS|Damage|Dot|Crit|Speed$|HitChance|Accuracy|Cooldown|Seal|Channel|Cost|AreaOfEffect|Culling/.test(
      name
    )
  )
    return "Offence & skills"
  if (
    /Life|Mana|Spirit|EnergyShield|Ward|Armour|Evasion|Evade|Resist|Block|Dodge|Suppression|Deflect|MaximumHit|EHP|Darkness/.test(
      name
    )
  )
    return "Defences & resources"
  return "Character & utility"
}
