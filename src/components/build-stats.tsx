import type { ReactNode } from "react"
import { buildSkill, displayStat, statValue } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

type StatRow = [label: string, key: string, suffix?: string, scale?: number]

const groups: { title: string; rows: StatRow[] }[] = [
  {
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
  {
    title: "Recovery",
    rows: [
      ["Life regen", "LifeRegenRecovery", "/s"],
      ["Mana regen", "ManaRegenRecovery", "/s"],
      ["Energy shield regen", "EnergyShieldRegenRecovery", "/s"],
      ["Energy shield recharge", "EnergyShieldRecharge", "/s"],
      ["Recharge delay", "EnergyShieldRechargeDelay", "s"],
    ],
  },
  {
    title: "Main skill",
    rows: [
      ["Combined DPS", "CombinedDPS"],
      ["Average hit", "AverageHit"],
      ["Critical chance", "CritChance", "%"],
      ["Critical multiplier", "CritMultiplier", "×"],
      ["Hit chance", "HitChance", "%"],
      ["Mana cost", "ManaCost"],
    ],
  },
]

export function BuildStats({ build }: { build: BuildSnapshot }) {
  function value(key: string, suffix = "", scale = 1) {
    const raw = statValue(build, key)
    const formatted = displayStat(
      raw !== undefined && scale !== 1 ? String(Number(raw) * scale) : raw
    )
    return formatted === "—" ? formatted : formatted + suffix
  }
  function row(label: string, content: ReactNode) {
    return (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{content}</dd>
      </div>
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
      <span className="build-stat-values">
        {entries.map(([key, label, tone]) => (
          <span
            key={key}
            title={label}
            aria-label={label + ": " + value(key, suffix)}
            data-tone={tone}
          >
            {value(key, suffix)}
          </span>
        ))}
      </span>
    )
  }
  return (
    <section className="build-stats-panel" aria-label="Build stats">
      <div className="build-section-heading">
        <h2>Stats</h2>
      </div>
      <div className="build-stats-body">
        <section>
          <h3>Character</h3>
          <dl>
            {row(
              "Attributes",
              multiple([
                ["Str", "Strength", "red"],
                ["Dex", "Dexterity", "green"],
                ["Int", "Intelligence", "blue"],
              ])
            )}
            {rows([
              ["Movement speed", "EffectiveMovementSpeedMod", "%", 100],
              ["Item rarity", "LootRarity", "%"],
            ])}
            {row(
              "Maximum charges",
              multiple([
                ["EnduranceChargesMax", "Endurance", "red"],
                ["FrenzyChargesMax", "Frenzy", "green"],
                ["PowerChargesMax", "Power", "blue"],
              ])
            )}
          </dl>
        </section>
        {groups.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.title === "Main skill" && (
              <p className="build-stats-skill">{buildSkill(build)}</p>
            )}
            <dl>
              {rows(group.rows)}
              {group.title === "Defensive" && (
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
            </dl>
          </section>
        ))}
        <p className="build-stats-note">
          Saved PoB values. Missing stats are omitted; switching equipment sets
          does not recalculate them.
        </p>
      </div>
    </section>
  )
}
