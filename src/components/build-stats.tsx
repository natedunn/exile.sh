import { equipmentRarity } from "../../shared/equipment-rarity"
import { BuildExpandedStats } from "./build-expanded-stats"
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip"
import { Note } from "./ui/note"
import {
  StatsBody,
  StatsCaption,
  StatsHeading,
  StatsList,
  StatsRow,
  StatsSection,
} from "./build/stats-ledger"
import type { ReactNode } from "react"
import { buildSkill, displayStat, statValue } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

type StatRow = [label: string, key: string, suffix?: string, scale?: number]
export type StatGroup = "character" | "defensive" | "recovery" | "main"

/** Attribute, charge, resistance and hit-taken figures in their element's colour. */
const toneClass: Record<string, string> = {
  red: "text-tone-red",
  green: "text-tone-green",
  blue: "text-tone-blue",
  yellow: "text-tone-yellow",
  purple: "text-tone-purple",
}

const groups: Record<StatGroup, { title: string; rows: StatRow[] }> = {
  character: {
    title: "Character",
    rows: [["Movement speed", "EffectiveMovementSpeedMod", "%", 100]],
  },
  defensive: {
    title: "Defensive",
    rows: [
      ["Life", "Life"],
      ["Energy shield", "EnergyShield"],
      ["Runic ward", "Ward"],
      ["Mana", "Mana"],
      ["Spirit", "Spirit"],
      ["Armour", "Armour"],
      ["Damage reduction", "PhysicalDamageReduction", "%"],
      ["Evasion rating", "Evasion"],
      ["Evade chance", "EvadeChance", "%"],
      ["Block chance", "EffectiveBlockChance", "%"],
      ["Effective health pool", "TotalEHP"],
    ],
  },
  recovery: {
    title: "Recovery",
    rows: [
      ["Life regen", "LifeRegenRecovery", "/s"],
      ["Mana regen", "ManaRegenRecovery", "/s"],
      ["Energy shield regen", "EnergyShieldRegenRecovery", "/s"],
      ["Energy shield recharge", "EnergyShieldRecharge", "/s"],
      ["Recharge delay", "EnergyShieldRechargeDelay", "s"],
    ],
  },
  main: {
    title: "Main skill",
    rows: [
      ["Combined DPS", "CombinedDPS"],
      ["Average hit", "AverageHit"],
      ["Effective critical chance", "CritChance", "%"],
      ["Critical multiplier", "CritMultiplier", "×"],
      ["Hit chance", "HitChance", "%"],
      ["Mana cost", "ManaCost"],
    ],
  },
}

/** Saved PoB stats for the groups a section cares about. */
export function BuildStats({
  build,
  groups: selected,
  note,
  gear,
  weapons = "primary",
}: {
  build: BuildSnapshot
  groups: StatGroup[]
  note?: string
  gear?: BuildSnapshot["itemSets"][number]
  weapons?: "primary" | "swap"
}) {
  const rarity = equipmentRarity(build, gear, weapons)
  function value(key: string, suffix = "", scale = 1) {
    const raw = statValue(build, key)
    const formatted = displayStat(
      raw !== undefined && scale !== 1 ? String(Number(raw) * scale) : raw
    )
    return formatted === "—" ? formatted : formatted + suffix
  }
  function row(label: string, content: ReactNode) {
    return (
      <StatsRow key={label} label={label}>
        {content}
      </StatsRow>
    )
  }
  function rows(entries: StatRow[]) {
    return entries
      .filter(([, key]) => statValue(build, key) !== undefined)
      .map(([label, key, suffix, scale]) =>
        row(label, value(key, suffix, scale))
      )
  }
  function multiple(entries: [string, string, string][], suffix = "") {
    return (
      <span className="inline-flex flex-wrap justify-end gap-1 [&>span+span]:before:mr-1 [&>span+span]:before:text-ink-faint [&>span+span]:before:content-['/']">
        {entries.map(([key, label, tone]) => (
          <Tooltip key={key}>
            <TooltipTrigger
              render={<span />}
              tabIndex={0}
              aria-label={label + ": " + value(key, suffix)}
              data-tone={tone}
              className={toneClass[tone]}
            >
              {value(key, suffix)}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </span>
    )
  }
  return (
    <StatsBody>
      {selected.map((group) => (
        <StatsSection key={group}>
          <StatsHeading>{groups[group].title}</StatsHeading>
          {group === "main" && <StatsCaption>{buildSkill(build)}</StatsCaption>}
          <StatsList>
            {group === "character" &&
              row(
                "Attributes",
                multiple([
                  ["Str", "Strength", "red"],
                  ["Dex", "Dexterity", "green"],
                  ["Int", "Intelligence", "blue"],
                ])
              )}
            {rows(groups[group].rows)}
            {group === "character" &&
              row(
                "Maximum charges",
                multiple([
                  ["EnduranceChargesMax", "Endurance", "red"],
                  ["FrenzyChargesMax", "Frenzy", "green"],
                  ["PowerChargesMax", "Power", "blue"],
                ])
              )}
            {group === "character" &&
              row(
                "Item rarity",
                rarity === undefined ? "—" : `${displayStat(String(rarity))}%`
              )}
            {group === "defensive" && (
              <>
                {row(
                  "Resistances",
                  multiple(
                    [
                      ["FireResist", "Fire", "red"],
                      ["ColdResist", "Cold", "blue"],
                      ["LightningResist", "Lightning", "yellow"],
                      ["ChaosResist", "Chaos", "purple"],
                    ],
                    "%"
                  )
                )}
                {row(
                  "Max hit",
                  multiple([
                    ["PhysicalMaximumHitTaken", "Physical", "neutral"],
                    ["FireMaximumHitTaken", "Fire", "red"],
                    ["ColdMaximumHitTaken", "Cold", "blue"],
                    ["LightningMaximumHitTaken", "Lightning", "yellow"],
                    ["ChaosMaximumHitTaken", "Chaos", "purple"],
                  ])
                )}
              </>
            )}
          </StatsList>
        </StatsSection>
      ))}
      {note && <Note className="m-0 text-label">{note}</Note>}
      {selected.includes("character") && <BuildExpandedStats build={build} />}
    </StatsBody>
  )
}
