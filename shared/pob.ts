import { Decompress, strFromU8 } from "fflate"
import { XMLParser, XMLValidator } from "fast-xml-parser"

export const MAX_CODE_LENGTH = 180_000
export const MAX_XML_BYTES = 2_000_000
export type XmlNode = {
  tag: string
  attrs: Record<string, string | undefined>
  text: string
  children: XmlNode[]
}
export type BuildSnapshot = {
  parserVersion: 1
  className: string
  ascendancy: string
  level: number
  mainSocketGroup: number
  stats: { name: string; value: string }[]
  minionStats: { name: string; value: string }[]
  fullDps: { name: string; value: string }[]
  skillSets: {
    id: string
    title: string
    skills: {
      label: string
      slot: string
      enabled: boolean
      gems: {
        name: string
        gemId?: string
        skillId?: string
        variantId?: string
        corrupted?: boolean
        corruptLevel?: string
        statSetIndex?: string
        level: string
        quality: string
        enabled: boolean
        support: boolean
      }[]
    }[]
  }[]
  activeSkillSet: string
  items: {
    id: string
    text: string
    name: string
    rarity: string
    selectedVariants?: string[]
  }[]
  itemSets: {
    id: string
    title: string
    slots: { name: string; itemId: string }[]
  }[]
  activeItemSet: string
  treeSpecs: {
    title: string
    version: string
    nodes: string[]
    sockets?: { nodeId: string; itemId: string }[]
    attributeOverrides?: {
      strength: string[]
      dexterity: string[]
      intelligence: string[]
    }
    // Passives allocated only while a weapon set is active. Both lists are
    // subsets of `nodes`; everything else in `nodes` applies to both sets.
    weaponSet1?: string[]
    weaponSet2?: string[]
  }[]
  activeSpec: number
  configSets: {
    id: string
    title: string
    inputs: { name: string; value: string }[]
  }[]
  activeConfigSet: string
  notes: string
}
export function normalizeCode(input: string) {
  if (input.length > MAX_CODE_LENGTH * 2)
    throw new Error("This export is too large (180 KB maximum).")
  const code = input.replace(/\s/g, "")
  if (
    !code ||
    code.length > MAX_CODE_LENGTH ||
    !/^[A-Za-z0-9+/_-]+={0,2}$/.test(code)
  )
    throw new Error("Paste a Path of Building 2 export code.")
  return code
}
export function decodeCode(input: string): string {
  const code = normalizeCode(input)
  try {
    const bytes = Uint8Array.from(
      atob(code.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    )
    const chunks: Uint8Array[] = []
    let size = 0
    const stream = new Decompress((chunk) => {
      size += chunk.length
      if (size > MAX_XML_BYTES) throw new Error("Expanded export exceeds 2 MB.")
      chunks.push(chunk)
    })
    // Small compressed chunks bound allocation even for highly compressible input.
    for (let i = 0; i < bytes.length; i += 128)
      stream.push(bytes.subarray(i, i + 128), i + 128 >= bytes.length)
    const result = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return strFromU8(result)
  } catch (error) {
    if (error instanceof Error && error.message.includes("2 MB")) throw error
    throw new Error(
      "This code could not be decoded. Export it again from Path of Building 2."
    )
  }
}
const nodeList = (value: string | undefined) => [
  ...new Set((value ?? "").split(",").filter(Boolean)),
]
const children = (node: XmlNode, tag: string) =>
  node.children.filter((n) => n.tag === tag)
const child = (node: XmlNode, tag: string): XmlNode =>
  children(node, tag).at(0) ?? { tag, attrs: {}, text: "", children: [] }
// Preserve document order, string IDs, and text rather than coercing XML values.
function nodes(raw: unknown, depth = 0): XmlNode[] {
  if (depth > 40) throw new Error("Export XML is nested too deeply.")
  if (!Array.isArray(raw)) return []
  if (raw.length > 8192) throw new Error("Too many entries in this export.")
  return raw.flatMap((entry: Record<string, unknown>) => {
    const tag = Object.keys(entry).find(
      (k) => k !== ":@" && k !== "#text" && !k.startsWith("?")
    )
    if (!tag) return []
    const contents = entry[tag]
    const attrs = Object.fromEntries(
      Object.entries((entry[":@"] ?? {}) as Record<string, unknown>).map(
        ([k, v]) => [k, String(v)]
      )
    )
    const text = Array.isArray(contents)
      ? contents
          .map((c) =>
            typeof c === "object" && c && "#text" in c ? String(c["#text"]) : ""
          )
          .join("")
      : ""
    return [{ tag, attrs, text, children: nodes(contents, depth + 1) }]
  })
}
export function parseBuildXml(xml: string): BuildSnapshot {
  if (new TextEncoder().encode(xml).length > MAX_XML_BYTES)
    throw new Error("Expanded export exceeds 2 MB.")
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml))
    throw new Error("XML document declarations are not supported.")
  if (XMLValidator.validate(xml) !== true)
    throw new Error("The export contains invalid XML.")
  const raw: unknown = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  }).parse(xml)
  const roots = nodes(raw)
  const root = roots.at(0)
  if (roots.length !== 1 || root?.tag !== "PathOfBuilding2")
    throw new Error("Only Path of Exile 2 builds are supported.")
  const build = child(root, "Build")
  const level = Number(build.attrs.level)
  if (
    !build.attrs.className ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 100
  )
    throw new Error("The export is missing valid character information.")
  const stats = (tag: string) =>
    children(build, tag).map((n) => ({
      name: n.attrs.stat ?? "Unknown",
      value: n.attrs.value ?? "",
    }))
  const skills = child(root, "Skills"),
    items = child(root, "Items"),
    tree = child(root, "Tree"),
    config = child(root, "Config")
  const sets = (node: XmlNode, tag: string) =>
    children(node, tag).length ? children(node, tag) : [node]
  const snapshot: BuildSnapshot = {
    parserVersion: 1,
    className: build.attrs.className,
    ascendancy:
      build.attrs.ascendClassName === "None"
        ? ""
        : (build.attrs.ascendClassName ?? ""),
    level,
    mainSocketGroup: Number(build.attrs.mainSocketGroup) || 1,
    stats: stats("PlayerStat"),
    minionStats: stats("MinionStat"),
    fullDps: stats("FullDPSSkill"),
    activeSkillSet: skills.attrs.activeSkillSet ?? "1",
    skillSets: sets(skills, "SkillSet").map((set, i) => ({
      id: set.attrs.id ?? String(i + 1),
      title: set.attrs.title || `Skill set ${i + 1}`,
      skills: children(set, "Skill").map((skill) => ({
        label: skill.attrs.label ?? "",
        slot: skill.attrs.slot ?? "",
        enabled: skill.attrs.enabled !== "false",
        gems: children(skill, "Gem").map((gem) => ({
          name: gem.attrs.nameSpec || gem.attrs.skillId || "Unknown gem",
          gemId: gem.attrs.gemId ?? "",
          skillId: gem.attrs.skillId ?? "",
          variantId: gem.attrs.variantId ?? "",
          corrupted: gem.attrs.corrupted === "true",
          corruptLevel: gem.attrs.corruptLevel ?? "0",
          statSetIndex: gem.attrs.statSetIndex ?? "1",
          level: gem.attrs.level ?? "",
          quality: gem.attrs.quality ?? "",
          enabled: gem.attrs.enabled !== "false",
          support: /Support/i.test(gem.attrs.gemId ?? gem.attrs.skillId ?? ""),
        })),
      })),
    })),
    activeItemSet: items.attrs.activeItemSet ?? "1",
    items: children(items, "Item").map((item) => {
      const lines = item.text.trim().split(/\r?\n/)
      return {
        id: item.attrs.id ?? "",
        selectedVariants: Object.entries(item.attrs)
          .filter(([key, value]) => /variant/i.test(key) && value)
          .map(([, value]) => value!),
        text: item.text.trim(),
        name: lines[1] || "Unnamed item",
        rarity: lines.at(0)?.replace("Rarity: ", "") ?? "",
      }
    }),
    itemSets: sets(items, "ItemSet").map((set, i) => ({
      id: set.attrs.id ?? String(i + 1),
      title: set.attrs.title || `Equipment ${i + 1}`,
      slots: children(set, "Slot").map((slot) => ({
        name: slot.attrs.name ?? "",
        itemId: slot.attrs.itemId ?? "",
      })),
    })),
    activeSpec: Math.max(0, (Number(tree.attrs.activeSpec) || 1) - 1),
    treeSpecs: children(tree, "Spec").map((spec, i) => ({
      title: spec.attrs.title || `Tree ${i + 1}`,
      version: spec.attrs.treeVersion ?? "unknown",
      nodes: nodeList(spec.attrs.nodes),
      attributeOverrides: {
        strength: nodeList(
          child(child(spec, "Overrides"), "AttributeOverride").attrs.strNodes
        ),
        dexterity: nodeList(
          child(child(spec, "Overrides"), "AttributeOverride").attrs.dexNodes
        ),
        intelligence: nodeList(
          child(child(spec, "Overrides"), "AttributeOverride").attrs.intNodes
        ),
      },
      sockets: children(child(spec, "Sockets"), "Socket")
        .map((socket) => ({
          nodeId: socket.attrs.nodeId ?? "",
          itemId: socket.attrs.itemId ?? "",
        }))
        .filter(
          (socket) => socket.nodeId && socket.itemId && socket.itemId !== "0"
        ),
      weaponSet1: nodeList(child(spec, "WeaponSet1").attrs.nodes),
      weaponSet2: nodeList(child(spec, "WeaponSet2").attrs.nodes),
    })),
    activeConfigSet: config.attrs.activeConfigSet ?? "1",
    configSets: sets(config, "ConfigSet").map((set, i) => ({
      id: set.attrs.id ?? String(i + 1),
      title: set.attrs.title || `Configuration ${i + 1}`,
      inputs: children(set, "Input").map((n) => ({
        name: n.attrs.name ?? "",
        value: n.attrs.string ?? n.attrs.number ?? n.attrs.boolean ?? "",
      })),
    })),
    notes: child(root, "Notes").text.trim(),
  }
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 550_000)
    throw new Error("This build contains too much data to share.")
  if (snapshot.treeSpecs.some((spec) => spec.nodes.length > 8192))
    throw new Error("Too many passive nodes in this export.")
  return snapshot
}
export const parseBuild = (code: string) => parseBuildXml(decodeCode(code))
export function statValue(build: BuildSnapshot, name: string) {
  return build.stats.find((s) => s.name === name)?.value
}
export function displayStat(value: string | undefined) {
  if (value === undefined || value === "") return "—"
  if (/^[-+]?inf(inity)?$/i.test(value))
    return value.startsWith("-") ? "−∞" : "∞"
  const n = Number(value)
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 1,
        notation: Math.abs(n) >= 1_000_000 ? "compact" : "standard",
      }).format(n)
    : "—"
}
export function buildSkill(build: BuildSnapshot) {
  const set = build.skillSets.find((s) => s.id === build.activeSkillSet)
  const skill = set?.skills[build.mainSocketGroup - 1]
  return (
    skill?.label ||
    skill?.gems
      .filter((g) => !g.support)
      .map((g) => g.name)
      .join(" / ") ||
    "Untitled build"
  )
}
export function pobbinRawUrl(input: string) {
  let url: URL
  try {
    url = new URL(input.startsWith("pobb.in/") ? `https://${input}` : input)
  } catch {
    throw new Error("Enter a valid pobb.in build URL.")
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "pobb.in" ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/(?:u\/[\w-]+\/)?[\w-]+(?:\/raw)?\/?$/.test(url.pathname)
  )
    throw new Error("Only https://pobb.in build links are supported.")
  return `https://pobb.in${url.pathname.replace(/\/$/, "").replace(/\/raw$/, "")}/raw`
}
