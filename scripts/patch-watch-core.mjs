import { createHash } from "node:crypto"

export const isManaged = (issue) =>
  issue.user?.login === "github-actions[bot]" && issue.user?.type === "Bot"
export const STATE_MARKER = "<!-- exile-patch-watch-state:v1 -->"
export const FAILURE_MARKER = "<!-- exile-patch-watch-failure:v1 -->"
export const marker = (id) => `<!-- exile-patch-watch:${id} -->`
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex")
export const normalize = (value) => value.replace(/\s+/g, " ").trim()
// Forum text is data, not Markdown, mentions, HTML or executable instructions.
export const quote = (value) =>
  normalize(value)
    .replace(/@/g, "＠")
    .replace(/[<>`*_\[\]\\]/g, "")

export const families = [
  {
    name: "Items and crafting",
    match:
      /\b(items?|uniques?|modifiers?|craft\w*|essences?|runeforg\w*|affix\w*|weapons?|armou?r|equipment)\b/i,
    paths: ["public/items/v1", "scripts/update-item-registry.py"],
    check:
      "Compare item definitions, modifier eligibility and crafting relationships against the frozen registry; review accepted PoE2DB differences.",
  },
  {
    name: "Skills and supports",
    match:
      /\b(gems?|skills?|supports?|damage|mana|cooldown|ailments?|buffs?|debuffs?)\b/i,
    paths: ["public/gems/v1", "shared/gem-compatibility.ts"],
    check:
      "Check gem values, descriptions, aliases and support compatibility. New behavior may need implementation, not only a data refresh.",
  },
  {
    name: "Trees and character rules",
    match:
      /\b(passives?|ascendan\w*|classes?|attributes?|jewels?|allocation\w*)\b/i,
    paths: ["shared/fixtures", "scripts/build-tree-assets.py"],
    check:
      "Compare node identities, stats and edges; preserve historical saved-build and tree versions.",
  },
  {
    name: "Augments and sockets",
    match: /\b(augments?|sockets?|runes?|soul cores?|talismans?)\b/i,
    paths: ["shared/augment-modifiers.json", "shared/socket-art.json"],
    check:
      "Review augment stats and socket/equipment eligibility together, including dependent gem and equipment consumers.",
  },
  {
    name: "Endgame and mechanics",
    match:
      /\b(atlas|genesis|maps?|waystones?|tablets?|dungeons?|boss\w*|league\w*|mechanic\w*|fortress\w*|conquer\w*|temples?)\b/i,
    paths: [
      "docs/game-data-updates.md",
      "scripts/build-atlas-assets.py",
      "scripts/build-genesis-assets.py",
    ],
    check:
      "Review affected endgame data and manually implemented rules. Check for new source families and unsupported mechanics before refreshing.",
  },
  {
    name: "Economy and league configuration",
    match: /\b(currency|exchange|trade|leagues?|economy|gold)\b/i,
    paths: [
      "shared/economy.ts",
      "shared/catalog.json",
      "convex/functions/ingestion.ts",
    ],
    check:
      "Check league allowlists, currency identities and metadata, plus feed schema assumptions; a successful live import does not refresh reference metadata.",
  },
]
const operational =
  /^(?:fixed|improved|added|reduced|we (?:have )?|this (?:patch|update) |server|realm|scheduled|maintenance|restart|deployment|crash|stability|performance|disconnect|login|queue)/i
const operationalSubject =
  /\b(server|realm|maintenance|restart|deployment|crash\w*|stability|performance|disconnect\w*|login|queue|latency|shader\w*|audio|sound|visual|render\w*)\b/i
const change =
  /\b(add\w*|remov\w*|chang\w*|adjust\w*|increas\w*|reduc\w*|fix\w*|now|no longer|new|rework\w*|improv\w*|updat\w*)\b/i

export function analyze(lines) {
  const significant = lines
    .map(normalize)
    .filter(Boolean)
    .filter((line) => {
      if (
        !change.test(line) &&
        !/\b(previously|deals?|grants?|provides?)\b|\d+(?:\.\d+)?\s*(?:%|less|more)/i.test(
          line
        )
      )
        return false
      // Only suppress clearly operational entries with no game-system signal.
      return !(
        operational.test(line) &&
        operationalSubject.test(line) &&
        !families.some((f) => f.match.test(line))
      )
    })
  const matches = families.flatMap((family) => {
    const evidence = significant.filter((line) => family.match.test(line))
    return evidence.length ? [{ ...family, evidence }] : []
  })
  const unknown = significant.filter(
    (line) => !families.some((f) => f.match.test(line))
  )
  return {
    significant,
    matches,
    unknown,
    fingerprint: digest(JSON.stringify(significant)),
  }
}

export function issueBody(post, result) {
  const sections = result.matches.map(
    (f) =>
      `### ${f.name}\n\n- Evidence: ${f.evidence
        .slice(0, 3)
        .map((s) => `“${quote(s).slice(0, 450)}”`)
        .join(
          "; "
        )}\n- Inspect: ${f.paths.map((p) => `\`${p}\``).join(", ")}\n- Check: ${f.check}`
  )
  if (result.unknown.length)
    sections.push(
      `### Unmapped changes requiring coverage review\n\n${result.unknown
        .slice(0, 5)
        .map((s) => `- ${quote(s).slice(0, 450)}`)
        .join(
          "\n"
        )}\n\nThese change descriptions were not mapped to a known data family. Review the source/consumer inventory to decide whether the app is affected; this is not a claim of breakage.`
    )
  return `${marker(post.id)}\n<!-- evidence:${result.fingerprint} -->\n@${post.owner} Please review these announced PoE2 changes for repository impact.\n\nSource: [${quote(post.title)}](${post.url})\nPublished date: ${new Date(post.date).toISOString().slice(0, 10)}\n\n${sections.join("\n\n")}\n\n## Acceptance checklist\n\n- [ ] Review the full official notes (including changes outside the examples above); record affected and unaffected data/mechanics in the patch ledger.\n- [ ] Check source readiness independently for RePoE, PoB and PoE2DB. Do not infer readiness from the patch date.\n- [ ] For data changes, follow [the maintenance CLI](https://github.com/natedunn/exile.sh/blob/main/docs/data-maintenance-cli.md) and [update runbook](https://github.com/natedunn/exile.sh/blob/main/docs/game-data-updates.md): plan → capture → isolated generation → audit → test → check → prepare → verify.\n- [ ] Implement/review new mechanics separately; preserve historical builds and immutable assets.\n\nClassification is conservative, deterministic triage, not semantic verification. A new build is not automatically required. No game data was changed, and no build, merge or deployment was run.\n`
}

export function readState(body) {
  if (!body?.startsWith(STATE_MARKER))
    throw new Error("Invalid patch-watch state marker")
  const json = body.match(/```json\n([\s\S]*?)\n```/)?.[1]
  const state = JSON.parse(json ?? "null")
  if (
    state?.version !== 1 ||
    !state.posts ||
    typeof state.posts !== "object" ||
    Array.isArray(state.posts)
  )
    throw new Error("Invalid patch-watch state")
  return state
}
export const stateBody = (state) =>
  `${STATE_MARKER}\nInternal checkpoint for the patch watcher. Keep this closed issue; deleting it resets the baseline. It contains no credentials.\n\n\`\`\`json\n${JSON.stringify(state)}\n\`\`\`\n`

export async function reconcile({ posts, state, issues, saveIssue }) {
  const next = structuredClone(state)
  for (const post of posts) {
    const result = analyze(post.lines)
    const previous = state.posts[post.id]
    const hash = digest(JSON.stringify([post.title, post.lines]))
    if (previous?.hash === hash) continue
    const existing = issues.find(
      (issue) =>
        !issue.pull_request &&
        isManaged(issue) &&
        issue.body?.includes(marker(post.id))
    )
    // The source URL in another issue/PR signals existing ownership. Never open
    // a competing issue; closed records count as handled until a maintainer opts in.
    const covered =
      (!previous || previous.evidence === result.fingerprint) &&
      issues.find(
        (issue) =>
          (isManaged(issue) || issue.user?.login === "natedunn") &&
          !issue.body?.startsWith(STATE_MARKER) &&
          !issue.body?.includes(marker(post.id)) &&
          issue.body?.includes(post.url)
      )
    if (
      existing &&
      !result.significant.length &&
      previous?.evidence !== result.fingerprint &&
      !existing.body?.includes(`<!-- evidence:${result.fingerprint} -->`)
    ) {
      await saveIssue(existing, {
        title: `PoE2 notes revised: ${quote(post.title).slice(0, 160)}`,
        body: `${marker(post.id)}\n<!-- evidence:${result.fingerprint} -->\n@${post.owner} Previously actionable text was removed or no longer classified as actionable in [the official notes](${post.url}). Inspect the revision before proceeding with earlier advice. This may be a retraction or a wording change that the heuristic cannot interpret; no stale impact recommendations are retained.`,
        state: "open",
      })
    }
    if (
      result.significant.length &&
      !covered &&
      result.fingerprint !== previous?.evidence
    ) {
      // Closing an issue acknowledges that version; an actual edited change
      // description reopens it. Retry after a checkpoint failure is idempotent.
      if (
        !existing?.body?.includes(`<!-- evidence:${result.fingerprint} -->`)
      ) {
        const saved = await saveIssue(existing, {
          title: `PoE2 impact review: ${quote(post.title).slice(0, 160)}`,
          body: issueBody(post, result),
          state: "open",
        })
        if (!existing) issues.push(saved)
      }
    }
    next.posts[post.id] = { hash, evidence: result.fingerprint, url: post.url }
  }
  return next
}

export function selectPosts(known, discovered, limit = 100) {
  return [
    ...new Map(
      [...known, ...discovered].map((post) => [post.id, post])
    ).values(),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, limit)
}
