# Game data audit and patch-update runbook

Initial audit: 2026-10-05. Local maintenance implementation: 2026-10-14.
Use the [local maintenance CLI](data-maintenance-cli.md) for the implemented
capture → generate → test → check → prepare → verify/rollback workflow.
The findings below retain the initial audit context. This describes the checked-in implementation, not a claim
that its snapshots match today's live game. Read this before changing sources,
refresh scripts, generated assets, league configuration, or patch-dependent rules.
See also [item coverage](item-registry.md), [operations](operations.md),
[build sharing](build-sharing.md), and [attribution](../NOTICE.md).

## Policy and responsibilities

A game patch starts an investigation; it does not authorize treating every
upstream source as ready. RePoE, PoB and PoE2DB update independently. Fetch time,
a successful HTTP response, a new commit, matching counts, and passing tests are
not proof that a source implements the target patch. Never assume which source
will update first. Never convert an unexplained mismatch into an accepted difference
just to make a release pass.

**New leagues, new mechanics, and substantially changed mechanics require manual
work by the developer and the implementing agent.** The agent must identify the
needed rules, interfaces, migrations and unsupported cases; the developer and
agent review the game evidence and intended behavior together. Refreshing numbers
cannot implement a new mechanic. Automated detection and extraction assist this
work; they do not establish mechanic correctness or authorize publication.

The implementing agent owns source discovery, exact provenance, the dependency
map, change report, investigation of disagreements, candidate generation,
regression tests, preview verification, rollback instructions and handoff. The
developer owns product decisions about new mechanics, review of accepted source
differences, and the decision to publish a partially supported patch. Release
execution follows the authorization already given for that task; this document
is not a new permission requirement for routine investigation or local work.

Keep the last verified feature snapshot while dependencies lag. Record that it
is an older reference, rather than calling the whole app current. Independent
features can move separately; files joined by one feature must move together.
Preserve saved builds, bookmarks, annotations and historical snapshots. Unknown
content stays unknown, not silently mapped to the newest equivalent.

## Source and consumer inventory

All paths below are relative to the repository. A source's authority is specific
to a field: official patch notes establish announced changes, exports describe
extracted records, and planner data adds interpretations. None alone proves
current availability or a valid crafting sequence.

| Data family                               | Inputs and their role                                                                                                                   | Generated/storage destinations and consumers                                                                                                                           | Update entry points                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exchange history                          | Official GGG PoE2 Currency Exchange hourly feed; actual exchange aggregates, not unique-item prices                                     | Convex archives, import ledger, item-day history, current snapshots and pair chunks; economy pages                                                                     | `convex/functions/ingestion.ts`, `store.ts`, `shared/economy.ts`; operational imports in `operations.md`                                                                                                                                                     |
| Economy item metadata                     | RePoE `base_items.min.json`; names, categories, descriptions and remote artwork paths                                                   | `shared/catalog.json`, `shared/catalog-source.json`; `src/lib/catalog.ts`, currency details, filters and share images                                                  | `scripts/update-catalog.py`; review its hand-written category mapping                                                                                                                                                                                        |
| Item reference and modifier pools         | Pinned PoB bases, uniques, modifier IDs and essence mappings; RePoE bases, mods, uniques and augments                                   | `public/items/v1/{catalogue,modifiers,source}.json`; Items, tooltips, SEO metadata                                                                                     | `scripts/update-item-registry.py`; `--refresh` replaces inputs, including mutable RePoE exports, but does not advance the hard-coded PoB revision                                                                                                            |
| Item pool verification                    | PoE2DB class pages, an independent comparison; not the registry's displayed modifier source                                             | `scripts/data/poe2db-modifier-pools.json`, accepted differences; `shared/item-registry-poe2db.test.ts`                                                                 | `scripts/snapshot-poe2db.py`; `bun run items:refresh` chains generation, capture and comparison                                                                                                                                                              |
| Unique Runeforging relationships          | Manually captured PoE2DB recipe rows; explicit metadata-ID mappings checked against vaal.tools game-file recipe tables                  | `scripts/data/{runeforging-recipes,unique-runeforging}.json`; registry paths and unresolved-recipe diagnostics                                                         | Manual refresh and review, then registry generation; `--refresh` does not update recipes                                                                                                                                                                     |
| Gem catalogue and artwork                 | Pinned PoB `Gems.lua`, skill files and DDS arrays; RePoE skill-gem metadata/art fallback                                                | `public/gems/v1/{catalogue,source}.json`, icons; Skills, Build Bin, tooltips and SEO                                                                                   | `scripts/update-gem-art.py`                                                                                                                                                                                                                                  |
| Gem headers, effects, matching and search | Same pinned PoB gem/skill data and stat descriptions; effect generation runs upstream Lua at build time                                 | `public/gems/v1/{headers,support-compatibility,search-index}.json`, `public/gems/effects-v1/`, `shared/gem-name-aliases.json`                                          | `build-gem-headers.py`, `update-gem-effects.py`, `build-gem-compatibility.py`, `build-gem-search-index.py`, `update-gem-name-aliases.py`                                                                                                                     |
| Keyword definitions                       | RePoE keywords and skills for frozen definitions, aliases and linked descriptions; frozen definitions reviewed with the gem snapshot    | `public/gems/v1/{keywords,keyword-aliases}.json`; `src/components/gem-keyword-text.tsx` loads the selected frozen local snapshot                                       | `scripts/update-gem-keywords.py`; generation now runs through the frozen source adapter                                                                                                                                                                      |
| Augment references                        | PoB `ModRunes.lua` at the gem catalogue revision; distinct from registry augments from RePoE                                            | `public/augments/v1/`, `shared/augment-modifiers{,-source}.json`; augment pages, build item text and bonded effects                                                    | `scripts/update-augment-modifiers.py`; currently refuses existing published output                                                                                                                                                                           |
| Equipment and socket artwork              | RePoE bases and uniques; game artwork mirrored locally                                                                                  | `shared/{equipment-art,socket-art}{,-source}.json`, local artwork; Build Bin                                                                                           | `scripts/update-equipment-art.py`, `scripts/update-socket-art.py`; failed equipment downloads are recorded                                                                                                                                                   |
| Character passive and ascendancy trees    | Versioned tree JSON and DDS arrays at pinned PoB commit; includes special Abyssal Lich overrides and Oracle unlock constraints          | `public/pob-trees/v4/`, `passives-v1/`, `art-v2/`, `ascendancies-v1/`, `ascendancy-v1/`, `node-reference-v1/`; `shared/generated/`, class artwork; Trees and Build Bin | `build-tree-assets.py`, `update-tree-art.py`, `update-tree-unseen.py`, `update-class-art.py`, `update-ascendancy-backgrounds.py`, `build-ascendancy-assets.py`, `build-abyssal-lich.py`, `build-passive-explorer-assets.py`, `build-item-node-references.py` |
| Atlas                                     | Frozen RePoE Atlas fixture; manually captured PoE2DB choice text bound to its hash; pinned exilecompass artwork mirror                  | `shared/fixtures/atlas/`, `public/atlas-trees/v2/`; standalone viewer                                                                                                  | `scripts/build-atlas-assets.py`; freeze and review new fixtures separately                                                                                                                                                                                   |
| Genesis                                   | Frozen RePoE BrequelTree and relevant stat translations; manually captured PoE2DB choice text bound to tree hash; PoE2DB artwork mirror | `shared/fixtures/genesis/`, `public/genesis-trees/v1/`; view-only viewer                                                                                               | `scripts/build-genesis-assets.py`; freeze all dependent fixtures together                                                                                                                                                                                    |
| Patch news                                | Official PoE2 patch forum listing and post HTML; announcements, not a reference-data readiness signal                                   | Convex patch threads/bodies; Patch Notes, read state and annotations; server post reads also exist                                                                     | `patchIngestion.ts`, `patchStore.ts`, `shared/forum-news.ts`, `src/lib/patch-notes-server.ts`; hourly discovery                                                                                                                                              |
| Social news                               | Official Path of Exile account through X API; optional announcement feed                                                                | Convex X state/posts; Patch Notes                                                                                                                                      | `xIngestion.ts`, `xStore.ts`; 15-minute cron ticks with persisted due time and enable/token gates                                                                                                                                                            |
| User builds                               | PoB XML/code and explicitly imported `pobb.in` raw exports; author-selected equipment, allocations and exported stats                   | Convex shared/saved builds, parsing in `shared/pob.ts`, Build Bin                                                                                                      | `convex/functions/builds.ts`, `shared/equipment.ts`; user imports, not patch refresh                                                                                                                                                                         |

Wiki and trade links are outbound references, not imported datasets. Artwork
mirrors establish image provenance, not mechanic truth. RePoE contains inherited
or unreleased content; the registry's PoB intersection intentionally limits some
coverage. Build Bin displays author-exported summary stats without a calculation
engine. Current gem references can differ from older saved builds; do not describe
reference refreshes as recalculating those builds.

Upstream references checked during this audit:
[RePoE](https://github.com/repoe-fork/repoe),
[PoB PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2),
[GGG API](https://www.pathofexile.com/developer/docs/reference#currency-exchange),
[PoE2DB](https://poe2db.tw/us/). RePoE explicitly allows export formats to change.
No update ordering or readiness SLA is assumed. Use the PoE2 exports, not PoE1
exports. Treat an internal export version and a public game patch as different
identifiers until evidence maps them.

## Initial audit: protections and gaps

The registry checks previously recorded input hashes on ordinary runs, pins PoB,
rejects unknown unique markup, excludes ambiguous identities with diagnostics,
and records counts and known limitations. New input URLs have no prior hash gate.
Its offline PoE2DB test requires explained differences and rejects exceptions
that no longer occur. It compares a representative base per captured class,
not every base's eligibility, unique, recipe, mechanic, or live availability.
Its normalized numeric keys also cannot establish full semantic equivalence.

Character trees retain historical versions. Atlas and Genesis supplements are
bound to exact fixture hashes and node identity/stats. Some generators reject
existing outputs, but many write files directly and lack atomic publication.
Current tests cover tree geometry, local art, item mappings, gem values,
support matching and unknown references. These are strong regression checks,
but expected snapshot-specific values must be reviewed when balance changes.

Exchange ingestion has schema checks, hashed compressed archives, bounded chunks,
leases, replay, transactional publication, an import completion ledger, monotonic
snapshots, backoff and a circuit breaker. Collection is separate from metadata
refresh. Raw archives last eight days and history 92 full UTC days plus today;
cleanup can lag. A new league absent from `LEAGUES` is filtered out of processed
markets even though raw archives may contain it. Discovery and rollover are manual.

Initial gaps, in priority order. The local pipeline now addresses capture,
accounting, acceptance and publication as detailed in the CLI guide; source truth
and mechanic review still require the developer and agent:

1. **Mutable inputs can form a mixed snapshot.** Registry RePoE files download
   separately, against a fixed PoB commit. Hashes identify bytes but not their
   compatible patch. Independent capture of PoE2DB may compare a different era.
   No shared release manifest or dependency readiness gate exists.
2. **Live keywords can change mechanics text without a release.** Local gem
   effects and aliases are pinned while tooltip definitions prefer mutable
   RePoE. A valid Shock entry is not a compatibility check. Plan to serve the
   verified local snapshot for reference pages; any intentionally live feed
   needs separate freshness labeling and compatibility policy.
3. **Refresh and cache contracts conflict.** `public/_headers` makes gems,
   effects, augments and tree revision URLs immutable for a year. Several
   generators still overwrite these destinations. React Query uses infinite
   staleness for some catalogues, and server asset reads cache per isolate.
   Item assets lack an explicit immutable rule but still use fixed paths and
   infinite query staleness. Publish changed data at new URLs and update all
   consumers/cache keys together. Clearing local cache is not a release fix.
4. **Freshness is fragmented.** Most PoB manifests share commit
   `ce566eac45ea8a86477f513c7ee65a1ebe60014e`. The economy metadata manifest is
   dated 2026-09-10 with RePoE base-items hash starting `74dd9610`; registry,
   equipment and socket inputs share a different hash starting `c95315f5`.
   This is snapshot divergence, not proof of wrong prices. Review changes to
   identities, category coverage and text explicitly. PoeDB pools were captured
   2026-10-02; a capture date still does not establish patch compatibility.
5. **Manual supplements need patch review.** Recipe mappings, Atlas choices,
   Genesis choices, augment slots, influence gates, special jewel rules and
   exclusions encode meaning a generic refresh cannot infer. A fixture hash
   protects a join, not the factual interpretation of its text.
6. **Reproduction and capture are incomplete.** Temporary caches are not durable
   raw-input archives. PoE2DB captures record date/URLs but not page hashes or
   patch evidence; `--cached` can reuse any existing file, despite its “today”
   comment. The snapshot script skips missing ModsView data and accepts any
   capture of at least 40 pages, so losing a formerly covered page can pass.
   File-count floors and parser regexes cannot prove complete semantic coverage.
7. **No automatic whole-release rollback.** Static references can be restored by
   reverting their selected asset bundle. Backend schema/rule changes, feed
   edits and new-league activation require separate recovery plans. Existing
   operational leases and last-good news behavior do not solve static release
   consistency.

These findings motivated the implemented local capture, staging, accounting and
acceptance commands. They do not add patch detection or a hosted scheduler. The
initial snapshot is not retroactively certified as matching a live patch.

## Readiness and release model

Track a patch target and a separate immutable data release ID. A feature bundle
names its exact source versions, hashes and manual supplements. One release can
use different PoB commits for independent historical datasets. Dependencies
within a bundle must agree on their shared inputs and intended patch semantics.
If unchanged older data is carried forward, record evidence that the patch did
not affect its fields. Do not require every unrelated source to update.

Use these states for each required source **for the affected feature**:

| State        | Meaning and next action                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| Waiting      | Target evidence is absent; retain last-good data and record next check           |
| Candidate    | Bytes changed or target evidence exists; freeze and investigate                  |
| Verified     | Schema, patch evidence, coverage and dependent joins reviewed                    |
| Disputed     | Sources disagree or evidence conflicts; identify affected fields and hold bundle |
| Failed       | Fetch/parser/integrity problem; preserve previous snapshot and diagnose          |
| Not affected | Prior snapshot deliberately reused with a reason tied to patch scope             |

Feature states: investigating → waiting/disputed → validated → published.
Mechanics review is an additional requirement before validation. A changed source
that is later corrected returns to candidate; recompute every downstream artifact.
An HTTP outage changes check status, not the game version or last-good snapshot.

Example: RePoE has new modifier values but PoB still has old modifier IDs.
The registry intersection could drop new modifiers. Freeze the candidate, record
the missing IDs and hold the item bundle. If PoE2DB instead updates first, freeze
its comparison without replacing accepted exceptions or comparing it as though it
were the old patch. News can publish independently. Artwork-only changes may ship
separately if their IDs/paths remain compatible. Source consensus is supporting
evidence, not majority voting; compare the exact field and patch evidence.

## Agent procedure for every patch

1. **Open a patch record.** Record official notes URL, patch identifier, release
   time/timezone, subsequent edits/hotfixes and baseline Git/deployment/data IDs.
   Read this runbook, relevant asset READMEs and domain docs. Classify impact by
   feature: news-only, numbers, identities/schema, balance semantics, league,
   new mechanic. A small hotfix can still change a mechanic.
2. **Map affected dependencies before refreshing.** For each feature, list
   required files/supplements, source states and why untouched data is safe to
   reuse. Search for hard-coded revisions, version labels, categories, source
   slots, node/skill IDs, paths and query keys. Do not just edit every occurrence
   of a PoB commit: historical snapshots must retain their own provenance.
3. **Freeze candidates in isolation.** Use a separate checkout/output area;
   existing scripts often write directly into published paths. Capture raw
   bytes once, exact URLs, upstream commit/export labels, UTC fetch time, hashes,
   parser version and evidence of target coverage. Reuse those bytes for all
   dependent generators. If the provider updates during a multi-file download,
   reacquire a coherent capture; prefer a provider commit when available. A
   before/after version-marker check helps but does not prove atomicity.
4. **Produce a semantic diff.** Report additions/removals, renames, ID changes,
   stat values, requirements, tags, pools, variants, slot/rule changes,
   diagnostics and unsupported fields. Compare counts to baseline, but account
   for each removal and large change. Check patch-specific sentinels: at least
   the announced changed skills/items/nodes actually used by affected features.
   Unchanged bytes are acceptable only with unchanged-field evidence.
5. **Resolve disagreements.** Distinguish source lag, incomplete export, parser
   failure, identity mismatch, wording differences and actual rule changes.
   Preserve conflicting evidence. Keep exceptions narrow and patch-scoped;
   revalidate every relevant existing exception. Owner review is required by
   `item-registry.md` for accepted differences. Never add a wildcard or blanket
   “source lag” exception to unblock publication.
6. **Do mechanics work with the developer.** Write explicit supported rules and
   unsupported cases, UI behavior and migration needs. Implement new source
   gates, slot maps, stat handlers or planner formats deliberately. Do not infer
   spawn probabilities from boolean eligibility, recipes from similar names,
   available content from release flags, or missing values as zero. Major-league
   work remains incomplete until its actual app requirements are reviewed.
7. **Generate one compatible feature bundle.** Follow the ordering below,
   publish into new immutable paths, retain historical files and update both
   server/client consumers, metadata, source links, headers and query keys.
   A supported tree label and its asset revision are separate concepts.
8. **Validate and preview.** Run relevant offline/domain tests, type checks and
   lint. Check affected browsers at mobile width and with keyboard access,
   old saved builds, removed/unknown IDs, cold cache and a warm prior-release
   session. Respect the running-server/build-isolation rules in `AGENTS.md`.
9. **Prepare publication and recovery.** Record exact candidate/last-good
   bundles, test results, known gaps, mechanics review and rollback steps. Ship
   through the existing deployment process when authorized. Watch feature errors,
   missing asset/ID rates, unknown markets, snapshot ages and import circuits.
   Never label the entire patch supported because one feature passed.
10. **Leave a handoff.** Record which sources remain waiting/disputed, exact
    blockers, next check time, manual questions and how to reproduce the diff.
    When sources catch up, resume from frozen candidates; do not repeat a blind
    whole-app refresh. A correction after publication gets its own data release.

## Dependency ordering and league handling

For items, freeze compatible PoB/RePoE inputs and review local recipes first;
then generate catalogue/modifiers/manifest; capture a patch-compatible PoE2DB
comparison separately; investigate differences; run registry and provenance tests.
`bun run items:refresh` now aliases isolated candidate generation and requires a
capture and output directory. Use the CLI workflow; generators no longer refresh
published files directly. Recipe fixtures and patch-compatible comparison inputs
must be explicitly captured and reviewed.

For gems, generate catalogue/art at the chosen pinned commit, then headers,
effects, aliases and compatibility; build search after effects; capture keywords
and linked descriptions from compatible RePoE inputs; update augment references
and mappings where affected. Use isolated Python environments: Pillow/zstandard
for image extraction and lupa Lua 5.1 for effects. The effects generator's existing
output guard requires a deliberate destination/code change for a new revision;
its `--refresh` is not a general latest-source selector. The augment generator
also requires a new destination. Preserve limits on interpolated/conditional data.

For character trees, generate new geometry/art, then derived explorer and
ascendancy assets, Abyssal Lich overrides, Oracle constraints, backgrounds, class
art and item-node references as affected. Register supported game versions in
`shared/tree-versions.ts`. Never migrate allocations using names or apply a new
snapshot to an old build silently. For Atlas/Genesis, freeze new tree fixtures,
revalidate choice node IDs/names/stats, translations and artwork, then emit a new
revision. Their export labels do not establish character-tree patch mapping.

For a new league, verify the exact names in actual GGG markets (including hardcore
variants), quote anchors and new currency IDs. Change the explicit allowlist,
default and relevant UI/tests/seeds deliberately. Preserve old-league history;
changing the allowlist alone does not provide historical league browsing. Define
that product behavior before removing an old league from accepted inputs.

The cursor is global, not per league. After adding a league, simply resuming
collection will not recover hours already imported without it. Review the
completion ledger/chunk replay logic before attempting a backfill: completed-hour
replay can skip work. Plan a bounded, idempotent per-league repair separately,
using available raw archives or the official retention window; test it in an
isolated backend. Never clear the production ledger/cursor or mix leagues into
one series as a shortcut. Unknown market IDs need truthful fallback identity and
must not be hidden solely because reference metadata lags.

## Implemented local framework and remaining enhancements

The [maintenance CLI](data-maintenance-cli.md) implements the five agreed steps:
explicit frozen captures and isolated generators, raw-record/extraction accounting,
a hash-bound patch acceptance gate, consistent immutable publication with pinned
keywords, and an executable offline rehearsal with failure tests. All operations
remain local/manual and publication preparation does not deploy.

Optional future work includes a source-readiness dashboard, more domain-specific
semantic diff views, automated discovery of new league names/market IDs, and
saved-reference release selection for old user exports. League rollover repair
and new systems still require separately tested feature/backend work. Neither a
new dashboard nor a hosted polling service is required to use the current process.

## Tests and verification

`shared/data-provenance.test.ts` now checks runtime-joined gem revisions/shared
skill hashes, duplicate augment source manifests, registry recipe input hashes,
and Atlas/Genesis supplement-to-fixture bindings. These checks are offline and
run in `bun run test`. They intentionally do not require all independent features
or historical trees to use the same source revision. Manifest agreement alone
cannot verify upstream truth or regenerated output completeness.

Existing useful suites: `shared/item-registry{,-poe2db}.test.ts`, gem/compatibility
and augment/bonded tests, tree/ascendancy/Atlas/Genesis tests, `shared/pob.test.ts`,
`convex/{ingestion,economy,builds,saved-builds,patch-storage,x-sync}.test.ts`.
Run `bun run test`, `bun run typecheck`, and `bun run lint` for a broad data release;
`bun run test:deploy` when deployment scripts change. Snapshot-specific assertions
should change only alongside source evidence, retaining invariant tests.

Failure cases to retain and broaden as new mechanics and sources are implemented
(the CLI guide lists the current automated coverage):

- RePoE ahead of PoB, PoE2DB ahead of both, old/new sources with plausible equal
  counts, and a source corrected after publication: only compatible bundles pass.
- A source changes midway through capture; unavailable source, truncated JSON,
  changed Lua/HTML schema, missing expected class page/pool, removed stat handler
  or unknown enum: fail capture/generation without touching last-good assets.
- Recipe, choice, augment or keyword supplement remains old while its inputs
  change: readiness fails, with specific unresolved fields rather than generic counts.
- Generator failure after one file and concurrent candidates: no partially
  selected bundle; changed immutable URL rejected; deterministic offline outputs.
- Removed/renamed item or gem, new tree version and unknown allocations: preserve
  saved identity and report missing references without substituting current data.
- New league present before metadata, empty league hour, already-completed hour
  before league activation and duplicate repair: no hidden loss or duplicate history.
- Warm-cache old session versus new deployment: each gets internally consistent
  catalogue/effects/art/metadata; new consumers cannot fetch an old fixed-path asset.
- An unexplained discrepancy or obsolete accepted exception cannot pass; relevant
  exception evidence must match candidate provenance.

Browser suites depend on the affected feature: `e2e/item-registry.spec.ts`,
`skills.spec.ts`, `augments.spec.ts`, `builds.spec.ts`, `passive-tree.spec.ts`,
`standalone-tree.spec.ts`, `tree-options.spec.ts`, `item-node-reference.spec.ts`
and `seo-rendering.spec.ts`. Use the existing server via `PLAYWRIGHT_BASE_URL`.
When tree search changes, run `e2e/tree-search.spec.ts` and compare
`scripts/measure-tree-search.mjs` under the same build/browser conditions.

## Recovery and handoff template

Revert feature selection and consumer paths to the last-good bundle; keep both
sets of static files. Reverting a Git commit does not repair overwritten immutable
URLs already cached by users: restore original bytes and release corrections at
new paths. For a failing collector, inspect state/logs, pause through its documented
flag if needed, fix the cause, then resume; reset a circuit only after diagnosis.
Preserve archived evidence within its retention period. Schema changes require a
compatible forward fix or separately tested migration/rollback; never assume
rolling back the Worker also rolls back Convex data.

Copy this record into a patch-specific issue or Markdown handoff:

```text
Target patch / official URL / released UTC / later edits:
Baseline Git, deployment and feature release IDs:
Affected features and mechanics requiring developer + agent work:
Sources: exact revision/hash, target evidence, state, last checked UTC, next check:
Dependency compatibility and deliberately reused older inputs:
Semantic diff: additions, removals, values/rules, IDs, coverage, diagnostics:
Disagreements and evidence; reviewed exceptions and unsupported behavior:
Manual mechanics decisions, implementation and unresolved questions:
Candidate artifact paths / manifest / reproduction commands:
Tests and browser/cache checks performed, with results:
Publication scope and authorization; waiting features and user-facing status:
Last-good bundle and static/backend recovery steps:
Next agent's exact blockers and next actions:
```

## Manual local workflow and preparation for 1.0

Follow-up review: 2026-10-14. Manual capture, generation and review before shipping
are the intended operating model. Frequent scheduled checking, automatic updates
and a new hosted pipeline are not prerequisites. The tooling should make a local
run repeatable, report omissions, and retain evidence between agent sessions.

The local framework now checks source identity, declared patch coverage, extraction
changes and reviewed acceptance. **It cannot independently establish the truth or
completeness of human patch evidence.** The four provenance checks above establish compatible
recorded inputs, not a target patch match. Use the implemented local capture, accounting, patch-acceptance and publication
workflow before each data release, including 1.0.

### Establishing that a source matches the patch

Use three different checks, recording evidence for each:

1. **Identity:** exact upstream commit/export label, raw bytes/hash and capture
   time. This establishes which data was used, not whether it is current.
2. **Patch coverage:** upstream changelog/diff plus the actual target changes in
   each required file. A planner release title or website banner is insufficient.
3. **App coverage:** the changed records survive our extraction and joins, retain
   new effects and requirements, and appear correctly through the consumer.

The [RePoE PoE2 index](https://repoe-fork.github.io/poe2/) exposes an export version
label; freeze it with the files, and establish its public-patch mapping separately.
The [RePoE index](https://repoe-fork.github.io/) also explains that PoB unique
records are hand-maintained. They can lag independently of extracted base data.
[PoB release notes](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases)
describe individual skill, tree, unique and behavior updates: evaluate those
families independently rather than treating one PoB release as all-or-nothing.
PoE2DB may publish patch/news content before every reference page is reconciled;
verify affected pages themselves. No common trustworthy machine-readable patch
identity has been established for all consumed inputs.

Create a change ledger from official patch notes and subsequent corrections.
Every relevant change gets an entry: official reference, stable identity where
available, affected feature/fields, expected behavior/value, required sources,
observed raw evidence, generated evidence, verification and disposition. Use
`verified`, `waiting`, `implementation-needed`, or `explicitly-out-of-scope`.
An out-of-scope decision requires a reason and truthful product claims; missing
support for an existing feature must not be disguised as unrelated new content.

For small patches, check each affected entry directly. For a major patch, account
for every relevant patch-note entry and every extracted addition/removal/change,
then use broader invariant tests and detailed manual inspection for new semantic
categories. Sampling is supplementary; a few changed skills do not prove all
balance changes landed. Patch notes may omit changes, so generated/raw diffs
must also feed the ledger. If the notes describe a change without an exact value,
retain that uncertainty and seek upstream or observed game evidence.

### Which sources block which updates

- **Items:** required PoB base/unique/essence/modifier-ID inputs and RePoE
  structured item/modifier inputs must support the affected records together.
  The existing independent PoE2DB pool cross-check also needs a compatible
  capture. Waiting comparison data means the affected item update remains
  blocked under the current validation policy; do not regenerate its exceptions
  to erase lag. Recipes are an additional dependency only when their paths change.
- **Skills:** required PoB catalogue, skill values, stat descriptions and headers
  must be compatible. RePoE is additionally needed for affected keyword text,
  linked descriptions and icon fallback metadata. A missing image alone need
  not block truthful text with a fallback; stale mechanic definitions do.
- **Trees:** required PoB geometry/stats and affected overrides must be updated.
  Atlas/Genesis have their own RePoE fixtures and reviewed choice/translation
  supplements; they are not made ready by the character tree changing.
- **Economy:** official completed-hour data, verified league identity, quote
  anchors and compatible parsing determine collection readiness. Reference
  metadata lag does not justify losing raw market data. Keep a clear distinction
  between collection, new-league activation and named-item presentation.
- **New 1.0 systems:** scope and implementation are feature work by the developer
  and agent. Build with explicit fixtures while sources are unavailable; hold
  current-data claims and activation until their factual dependencies are verified.

Sources are blocking dependencies for the fields they supply. Waiting for every
provider everywhere adds unnecessary delay; omitting a required provider's fields
from a claimed complete update creates false readiness. Any deliberate partial
release must name the unsupported scope and receive the developer's product review.

### Local audit command

Run from the repo or pass an explicit checkout root:

```sh
bun run data:audit > /tmp/exile-data-baseline.json
bun run data:audit --root /absolute/candidate-checkout --baseline /absolute/baseline-checkout > /tmp/exile-data-candidate.json
```

The command is read-only and offline. It inventories source manifests, hashes the
inspected assets, reports item diagnostics, missing/orphan/partial gem effects,
and lists captured PoE2DB class coverage. When given a baseline checkout, it
compares item/modifier/gem/essence/augment IDs, slot maps, influences, headers,
keywords/aliases, support matching, search and effect records; reports changed
top-level fields and artifact hashes; and identifies removed comparison pages.
Inspect the actual field values in the corresponding baseline/candidate files.
A changed numeric field and a new effect are both review work; the tool does not
infer that a text change is safely equivalent or that a numeric change is correct.

Malformed/missing required inputs fail the command; missing/partial effect
references are reported for investigation because some are deliberately unsupported.
Exit zero means the audit could read its inputs, **not that the patch is ready**.
The report always labels patch matching `unverified`. Its artifact fingerprint
binds a review to the inspected assets; it is not a full release-bundle hash.
Run the provenance/domain tests as well. Tree/source-raw comparisons and accepted
exception review remain separate. The command resolves published reference paths through the shared asset registry
and uses canonical paths inside isolated candidates. Keep the baseline checkout unchanged through
the comparison; a saved report alone is not the diff input.

The current local report finds two catalogue skill IDs without effect files
(`DestructiveLinkSkeletonBombadierMinion`, `SupportAnimusSplintersPlayer`) and one
partial effect (`ParryPlayer`), despite an empty effect-translation diagnostic list.
These are coverage gaps to investigate, not evidence of a live-game regression.
They demonstrate why successful generation and a clean diagnostics list are
insufficient. Compare such gaps to the baseline and review every newly introduced
one; do not require established unsupported actor-interpolation cases to vanish
just to update unrelated values.

### Implemented foundations to use before a large update

The local CLI provides these steps in dependency order; keep their invariants
when adding generators or supporting new mechanics:

1. **Explicit capture/config:** select the target patch and source commits in one
   local configuration; freeze required raw inputs and supplements once; let
   generators accept those inputs and an isolated output destination. Retain
   evidence and hashes; do not globally replace historical source revisions.
2. **Complete accounting:** emit all parsed IDs, exclusions and reasons, unknown
   domains/slots/enums/handlers, missing skill/stat sets, partial translations,
   and parser coverage. Compare raw and generated sets. The current modifier
   domain/generation filters and missing stat-set skips need this accounting:
   a new effect must become an explicit review item rather than disappear.
3. **Patch acceptance record:** bind each ledger check, reviewed discrepancy and
   generated test to the candidate's exact source/output hashes. A changed
   candidate invalidates affected checks. Reject missing required evidence,
   unexplained drops, unreviewed new partials and unresolved mechanic changes.
   This can be a local file and CLI; it does not need a hosted service.
4. **Safe publication:** select compatible new asset paths for both client and
   server, freeze mechanics definitions with their bundle, retain previous
   snapshots and verify warm-cache behavior. Complete this before any data refresh
   ships, even when generation and inspection are entirely manual.

Prepare the capture interface, raw-record accounting and fixture-based failure
checks before 1.0 data arrives. When providers are ready, the agent can then pin
inputs, produce the audit/diff, resolve the ledger, implement new semantics, and
publish a verified bundle without first rebuilding the maintenance process.
The acceptance gate and executable rehearsal are now implemented. See the CLI
guide for commands, review schemas and the boundary between automated checks and
human game-mechanics verification.
