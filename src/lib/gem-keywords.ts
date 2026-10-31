import { fetchDataAsset } from "../../shared/data-assets"

export type Keyword = { term: string; definition: string }
export type KeywordData = {
  keywords: Partial<Record<string, Keyword>>
  aliases: Record<string, string>
  descriptions: Record<string, string>
}
export type KeywordIndex = {
  definitions: Partial<Record<string, Keyword>>
  aliases: Map<string, string>
  descriptions: Record<string, string>
  pattern: RegExp
}

/* Labels the game never links. Swept on 2026-10-30 against RePoE's stat
 * descriptions (every item, unique and passive line) and skill text: each
 * appears there only as plain text. "maximum" alone is plain 2,095 times. */
const unlinked = new Set([
  "additional projectiles",
  "ancient",
  "attack's",
  "augments",
  "avatar of fire",
  "ballista totems",
  "banner skills",
  "boons",
  "brittle",
  "cartographer's strongbox",
  "chaos inoculation",
  "claws",
  "corrupted items",
  "crafted",
  "crafted modifiers",
  "desecrated ground",
  "detonator skills",
  "effigy",
  "enraged",
  "essence of delirium",
  "extra chaos damage",
  "extra cold damage",
  "extra content",
  "extra fire damage",
  "extra lightning damage",
  "foci",
  "fracture",
  "gloom shrine",
  "haste aura",
  "herald skills",
  "hiveblood",
  "increased area of effect",
  "increased life",
  "increased stun threshold",
  "life loss",
  "link skills",
  "map owner",
  "maximum",
  "maximum quality",
  "merging",
  "mirrored",
  "mirrored items",
  "offering skills",
  "omen",
  "orb of alteration",
  "phasing",
  "powerful minions",
  "quivers",
  "relic",
  "resolute technique",
  "shields",
  "slower",
  "splitting",
  "staves",
  "stuns",
  "surge",
  "talismans",
  "unique map",
  "unleash",
  "upfront costs",
  "wand",
  "wands",
])

/* Labels the game links to a different keyword than the generated alias. */
const relinked: Record<string, string> = {
  empowered: "Empowered",
  empowerment: "Empowered",
  invocation: "Invoke",
}

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "")

/* The game labels a keyword by context: "[ManaLeech|Mana]" inside a leech
 * sentence. The generated aliases keep such labels when the keyword's ID
 * starts with them, which turns every "Mana" into Mana Leech. A shortened
 * label stays only when it is the same word less an ending ("Ailment" for
 * Ailments, "Banners" for Banner); a different, shorter word goes. */
function contextOnly(name: string, key: string, keyword: Keyword) {
  const full = [key, keyword.term].map(compact)
  const label = compact(name)
  const stem = label.replace(/(?:es|ed|ing|s|d)$/, "")
  const shortened = full.some(
    (word) => word.startsWith(label) && word.length > label.length
  )
  const sameWord = full.some((word) =>
    [label, stem].some(
      (part) => word.startsWith(part) && word.length - part.length <= 4
    )
  )
  return shortened && !sameWord
}

export function keywordIndex(data: KeywordData): KeywordIndex {
  const aliases = new Map(
    Object.entries(data.aliases).filter(([name, key]) => {
      const keyword = data.keywords[key]
      return !keyword || !contextOnly(name, key, keyword)
    })
  )
  for (const [key, keyword] of Object.entries(data.keywords)) {
    if (!keyword?.term || !keyword.definition) continue
    aliases.set(keyword.term.toLowerCase(), key)
    if (/^[A-Z][a-zA-Z]+$/.test(key)) aliases.set(key.toLowerCase(), key)
  }
  // RePoE links all three charge types to Charges. The generated aliases omit
  // these labels because "Power Charge" does not resemble the ID "Charges".
  for (const type of ["power", "frenzy", "endurance"]) {
    aliases.set(`${type} charge`, "Charges")
    aliases.set(`${type} charges`, "Charges")
  }
  // Last, so a keyword's own name cannot bring an unlinked label back.
  for (const name of unlinked) aliases.delete(name)
  for (const [name, key] of Object.entries(relinked)) aliases.set(name, key)
  // "Gain" is the keyword for damage gained as extra damage. The game links
  // it only in that sense ("Gain 10% of Damage as Extra Fire Damage"), so
  // a bare "Gain 1 Rage on Hit" stays plain text.
  const gain = /^gain(?:s|ed|ing)?$/
  const names = [...aliases.keys()]
    .filter(
      (name) =>
        name &&
        !gain.test(name) &&
        data.keywords[aliases.get(name) ?? ""]?.definition
    )
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (data.keywords[aliases.get("gain") ?? ""]?.definition)
    names.push(String.raw`gain(?:s|ed|ing)?(?=[^.\n]*\bas extra\b)`)
  return {
    definitions: data.keywords,
    aliases,
    descriptions: data.descriptions,
    pattern: names.length
      ? new RegExp(`\\b(${names.join("|")})\\b`, "gi")
      : /(?!)/g,
  }
}

export async function loadGemKeywords(): Promise<KeywordData> {
  const read = async (path: string) => {
    const response = await fetchDataAsset(path)
    if (!response.ok)
      throw new Error(`Keyword reference returned ${response.status}`)
    return response.json()
  }
  const [snapshot, aliases] = await Promise.all([
    read("/gems/v1/keywords.json") as Promise<
      Partial<Pick<KeywordData, "keywords">>
    >,
    read("/gems/v1/keyword-aliases.json") as Promise<
      Partial<Omit<KeywordData, "keywords">>
    >,
  ])
  if (!snapshot.keywords || !aliases.aliases || !aliases.descriptions)
    throw new Error("Incomplete keyword snapshot")
  return {
    keywords: snapshot.keywords,
    aliases: aliases.aliases,
    descriptions: aliases.descriptions,
  }
}
