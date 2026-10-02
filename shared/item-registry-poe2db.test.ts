import { describe, expect, it } from "vitest"
import { readFileSync, writeFileSync } from "node:fs"
import type {
  BaseReference,
  ItemCatalogue,
  ModifierCatalogue,
  ModifierReference,
} from "./item-registry"
import {
  augmentOutcomes,
  baseInfluences,
  essenceOutcomes,
  modifierInfluence,
  modifierMatchesBase,
} from "./item-registry"

/* The generated registry against PoeDB's own reading of the game files.
 * Every difference must be fixed or listed, with a reason and evidence, in
 * scripts/data/poe2db-accepted-differences.json. See docs/item-registry.md. */

const read = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T

const catalogue = read<ItemCatalogue>("../public/items/v1/catalogue.json")
const modifiers = read<ModifierCatalogue>("../public/items/v1/modifiers.json")
const snapshot = read<{
  captured: string
  pages: Record<
    string,
    { itemClass: string; tags: string[]; pools: Record<string, string[]> }
  >
}>("../scripts/data/poe2db-modifier-pools.json")
const accepted = read<Accepted[]>(
  "../scripts/data/poe2db-accepted-differences.json"
)

type Side = "ours-only" | "poe2db-only"
type Accepted = {
  pages: string[]
  pool: string
  side: Side
  mods: string[]
  reason: string
  evidence: string
  reviewed: string
}
type Difference = { page: string; pool: string; side: Side; mods: string[] }

const itemClasses: Record<string, string> = {
  LifeFlask: "Life Flask",
  ManaFlask: "Mana Flask",
  UtilityFlask: "Charm",
}

/** PoeDB pages cover a whole class, so compare a base without element
 * exclusions (a chaos wand rightly lacks fire spell modifiers). */
function representative(
  itemClass: string,
  tags: string[]
): BaseReference | undefined {
  return Object.values(catalogue.items)
    .filter(
      (item): item is BaseReference =>
        item.kind === "base" &&
        item.form === "original" &&
        item.itemClass === itemClass &&
        tags.every((tag) => item.tags.includes(tag))
    )
    .sort(
      (a, b) =>
        a.tags.filter((tag) => tag.startsWith("no_")).length -
        b.tags.filter((tag) => tag.startsWith("no_")).length
    )[0]
}

/** Affix name, level, group and roll numbers: the key the snapshot uses. */
const rollKey = (mod: ModifierReference) =>
  [
    mod.name,
    mod.level,
    mod.groups.join("+"),
    (mod.text.match(/\d+(?:\.\d+)?/g) ?? [])
      .map((value) => String(Number(value)))
      .sort()
      .join(","),
  ].join("|")

const mods = Object.values(modifiers.mods)
const spawnsNowhere = (mod: ModifierReference) =>
  mod.eligibility.every((entry) => !entry.allowed)

/** What the item page shows for this base, pool by pool, in the
 * snapshot's terms. */
function ourPools(base: BaseReference) {
  const influence = (mod: ModifierReference) =>
    modifierInfluence(mod, modifiers.influences)
  const pool = mods.filter((mod) => modifierMatchesBase(mod, base))
  const rolls = (source: ModifierReference["source"]) =>
    pool.filter((mod) => mod.source === source && !influence(mod)).map(rollKey)
  const ids = (source: ModifierReference["source"]) =>
    pool.filter((mod) => mod.source === source).map((mod) => mod.id)
  const pools: Record<string, string[]> = {
    normal: rolls("normal"),
    desecrated: rolls("desecrated"),
    corrupted: ids("corruption"),
    sacrifice: ids("sacrifice"),
    essence: [
      ...new Set(essenceOutcomes(modifiers, base).map((row) => row.id)),
    ],
    augments: augmentOutcomes(modifiers, base.itemClass).map(
      (augment) => augment.name
    ),
  }
  const gated = new Set(baseInfluences(modifiers, base).map((i) => i.tag))
  for (const { tag } of modifiers.influences)
    pools[tag] = gated.has(tag)
      ? mods
          .filter(
            (mod) =>
              influence(mod)?.tag === tag &&
              modifierMatchesBase(mod, base, [tag])
          )
          .map((mod) => mod.id)
      : []
  return pools
}

/** PoeDB lists a class's every outcome; keep those this base can roll by
 * the same weights, so a list difference is a real disagreement. */
function theirPools(
  base: BaseReference,
  pools: Partial<Record<string, string[]>>
): Record<string, string[]> {
  const byId = new Map(mods.map((mod) => [mod.id, mod]))
  const rollable = (id: string, added: string[] = []) => {
    const mod = byId.get(id)
    return !mod || spawnsNowhere(mod) || modifierMatchesBase(mod, base, added)
  }
  const oneOf = new Set(
    modifiers.essences.flatMap((essence) => {
      const outcomes = Object.hasOwn(essence.mods, base.itemClass)
        ? essence.mods[base.itemClass]
        : []
      return outcomes.length > 1 ? outcomes.map((outcome) => outcome.id) : []
    })
  )
  const result: Record<string, string[]> = {}
  for (const [pool, entries] of Object.entries(pools))
    if (entries) result[pool] = entries
  result.essence = (pools.essence ?? []).filter(
    (id) => !oneOf.has(id) || rollable(id)
  )
  for (const { tag } of modifiers.influences)
    result[tag] = (pools[tag] ?? []).filter((id) => rollable(id, [tag]))
  return result
}

/** Multiset difference: a key twice on one side and once on the other
 * still differs. */
function minus(left: string[], right: string[]) {
  const counts = new Map<string, number>()
  for (const key of right) counts.set(key, (counts.get(key) ?? 0) + 1)
  return left.filter((key) => {
    const count = counts.get(key) ?? 0
    if (count > 0) counts.set(key, count - 1)
    return count === 0
  })
}

function differences(): Difference[] {
  const found: Difference[] = []
  for (const [page, { itemClass, tags, pools }] of Object.entries(
    snapshot.pages
  )) {
    const base = representative(itemClasses[itemClass] ?? itemClass, tags)
    if (!base) {
      found.push({ page, pool: "base", side: "poe2db-only", mods: [itemClass] })
      continue
    }
    const ours = ourPools(base)
    const theirs = theirPools(base, pools)
    for (const pool of new Set([
      ...Object.keys(ours),
      ...Object.keys(theirs),
    ])) {
      const mine = ours[pool] ?? []
      const yours = theirs[pool] ?? []
      const oursOnly = [...new Set(minus(mine, yours))].sort()
      const theirsOnly = [...new Set(minus(yours, mine))].sort()
      if (oursOnly.length)
        found.push({ page, pool, side: "ours-only", mods: oursOnly })
      if (theirsOnly.length)
        found.push({ page, pool, side: "poe2db-only", mods: theirsOnly })
    }
  }
  return found
}

/** One page's pool can differ for unrelated reasons (Alloys and an
 * accuracy naming on Bows), so each modifier needs some entry's reason. */
const applies = (entry: Accepted, difference: Difference) =>
  entry.pages.includes(difference.page) &&
  entry.pool === difference.pool &&
  entry.side === difference.side

const unexplainedMods = (difference: Difference) =>
  difference.mods.filter(
    (mod) =>
      !accepted.some(
        (entry) => applies(entry, difference) && entry.mods.includes(mod)
      )
  )

describe("item registry against PoeDB", () => {
  const found = differences()

  it("explains every accepted difference", () => {
    const problems = accepted.flatMap((entry, index) => {
      const label = `Entry ${index + 1} (${entry.pool}, ${entry.side})`
      return [
        entry.pages.length === 0 ||
        entry.pages.some((page) => page.includes("*"))
          ? `${label}: name each page; wildcards are not allowed.`
          : null,
        ...entry.pages
          .filter((page) => !Object.hasOwn(snapshot.pages, page))
          .map((page) => `${label}: ${page} is not in the snapshot.`),
        entry.mods.length === 0 ? `${label}: list the modifiers.` : null,
        entry.reason.trim().length < 20
          ? `${label}: write a reason a reviewer can judge.`
          : null,
        entry.evidence.trim().length < 10
          ? `${label}: say how to verify the reason.`
          : null,
        /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewed)
          ? null
          : `${label}: reviewed must be a YYYY-MM-DD date.`,
      ].filter((problem): problem is string => problem !== null)
    })
    expect(problems).toEqual([])
  })

  it("matches PoeDB except for accepted differences", () => {
    const unexplained = found
      .map((difference) => ({
        ...difference,
        mods: unexplainedMods(difference),
      }))
      .filter((difference) => difference.mods.length > 0)
    // Ready to paste into the accepted list once investigated. Blank
    // reasons fail the test above, so a draft silences nothing.
    const drafts = unexplained.map((difference) => ({
      pages: [difference.page],
      pool: difference.pool,
      side: difference.side,
      mods: difference.mods,
      reason: "",
      evidence: "",
      reviewed: "",
    }))
    // items:refresh sets this so drafts can be reviewed in full.
    if (process.env.POE2DB_DRAFTS)
      writeFileSync(
        process.env.POE2DB_DRAFTS,
        JSON.stringify(drafts, null, 2) + "\n"
      )
    expect(
      drafts,
      `Snapshot captured ${snapshot.captured}. Fix the data, or investigate ` +
        "and add an entry to scripts/data/poe2db-accepted-differences.json."
    ).toEqual([])
  })

  it("keeps no accepted difference that no longer occurs", () => {
    const stale = accepted.flatMap((entry, index) =>
      entry.pages
        .filter(
          (page) =>
            !found.some(
              (difference) =>
                difference.page === page &&
                applies(entry, difference) &&
                difference.mods.some((mod) => entry.mods.includes(mod))
            )
        )
        .map(
          (page) =>
            `Entry ${index + 1}: ${page} · ${entry.pool} · ${entry.side} no longer differs. Remove the page, or the entry.`
        )
    )
    expect(stale).toEqual([])
  })
})
