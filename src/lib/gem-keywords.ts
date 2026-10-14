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

export function keywordIndex(data: KeywordData): KeywordIndex {
  const aliases = new Map(Object.entries(data.aliases))
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
  const names = [...aliases.keys()]
    .filter(
      (name) => name && data.keywords[aliases.get(name) ?? ""]?.definition
    )
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
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
