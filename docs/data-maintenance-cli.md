# Local game-data maintenance

The maintenance process is local and manual. Commands capture sources, generate a
candidate, run tests, check patch evidence, and prepare reviewable checkout files.
They do not deploy the site or enable collectors. Start with the source/dependency
[audit and patch runbook](game-data-updates.md).

## Normal patch workflow

Use a separate output directory such as `.data-work/` (Git-ignored), and keep an
unchanged baseline checkout. New release IDs and capture/candidate destinations
must be unique. Preserve the captures until publication and subsequent review are
complete. Changing a source or tool implementation requires a new candidate and
fresh tests/reviews; editing a review alone does not regenerate data.

```sh
bun run data:plan --id patch-example-r1 --patch <game-patch> --official <official-notes-url> --features items,gems --pob <full-40-character-commit> --out .data-work/plan.json
bun run data:capture --config .data-work/plan.json --out .data-work/capture-r1
bun run data:generate --capture .data-work/capture-r1 --baseline /absolute/baseline-checkout --out .data-work/candidate-r1
bun run data:audit --root .data-work/candidate-r1 --baseline /absolute/baseline-checkout > .data-work/diff.json
bun run data:test --candidate .data-work/candidate-r1
node scripts/data-pipeline.mjs groups --candidate .data-work/candidate-r1
# Investigate issues and edit candidate-r1/review.json with patch-specific evidence.
bun run data:check --candidate .data-work/candidate-r1
bun run data:prepare --candidate .data-work/candidate-r1 --checkout /absolute/review-checkout
bun run data:verify --checkout /absolute/review-checkout
```

`items:refresh` now aliases isolated generation and requires `--capture` and
`--out`; it no longer downloads mutable sources into published files. Direct Python
generator calls refuse an unconfigured checkout. The runner supplies the stage,
capture adapter, pinned PoB revision, selected tree versions and fresh local cache.
The review checkout must contain the implementing checkout's exact code and package
configuration; preparation verifies their hashes. Keep its data at the chosen
baseline until preparation. Curate changed manual fixtures in scratch files and
point the capture plan at them, rather than overwriting review-checkout inputs. Generator
execution uses the implementing checkout's scripts, not older baseline scripts.

Supported feature names: `economy` (reference metadata), `items`, `gems`, `augments`,
`equipment`, `trees`, `atlas`, `genesis`. Generation orders dependencies regardless
of the order supplied. For trees, include `--trees 0_5` or the explicitly intended
versions in the plan. Register new supported game versions and implement new rules
as normal feature work; listing a version in a capture plan does not implement it.

Use Python 3.9+ with the dependencies required by the chosen generators. Image
extraction needs Pillow and zstandard; gem numerical effects need lupa with Lua
5.1 support. Create a dedicated virtual environment and record/pin its installed
versions for the patch; pass its executable with `data:generate --python <path>`.
The runner does not install or update dependencies automatically. Source hashes,
generator code hashes and output hashes remain part of candidate identity.

## Capture plan and source lag

`data:plan` drafts an inventory from existing manifests. **Review it before use.**
The draft is neither a latest-source detector nor a readiness assertion. It can
expand artwork from captured metadata as well as pinned PoB directory listings;
inspect those discoveries and any captured missing assets. It updates
PoB URLs to the chosen commit and can discover new files in pinned directories.
New artwork paths, new categories/pages, new supplements and new source families
may still need explicit additions. For large changes, inspect the upstream tree,
file lists and patch notes; do not just reuse the old list.

Each source has a unique `id`, `provider`, `features`, and either an HTTPS `url`
or a `local` file. An optional `sha256` rejects unexpected bytes during capture.
An optional HTTPS `downloadUrl` can pin the download to an immutable upstream
revision while `url` remains the canonical identity requested by the generator.
Local manual supplements also have a permitted `targetPath`, e.g.
`scripts/data/runeforging-recipes.json`; they cannot overwrite application code.
The item plan freezes the reviewed PoeDB exception list as well as recipe files.
The optional `sourceVersions` object records verified internal export labels
(e.g. `repoe`); an absent label stays unverified, rather than being guessed from
the game patch number. Local file paths resolve relative to the plan file. Keep source IDs stable between
patches so definition-level diffs remain meaningful.

A captured source records exact bytes, URL, status, SHA-256 and UTC capture time.
`capture.json` is written last. Failed captures never get that completion marker.
Raw bytes are content-addressed in `blobs/`. Captures cannot be overwritten.
A successful capture proves identity, **not patch compatibility or schema validity**.
Pin mutable multi-file exports to a known upstream revision through `downloadUrl`
where possible; otherwise review their coherence and record the uncertainty. A
single capture session is not a transaction on a third-party server.

PoE2DB class-page captures explicitly allow HTTP 404 where combinations do not
exist. That status is frozen and replayed as 404; it is distinct from an uncaptured
request. Missing ModsView content and newly absent comparison pages become review
issues, not successful empty pools. A 404 on a previously covered page must be
investigated. Do not declare a disappeared class intentionally unsupported based
only on a temporary upstream failure.

The Python adapter never falls back to the network. An uncaptured request fails
generation, including when importer code catches it as missing artwork. Inspect
`.source-access.json` in the failed candidate, add/review the necessary source in
the plan, capture to a new directory and regenerate to another new directory.
Do not weaken the adapter, reuse arbitrary temporary caches, or change source
exceptions to make an incomplete capture pass.

## Accounting and review

`candidate.json` binds configuration, capture, generator/consumer code, staged
assets/test inputs, source usage, raw-definition hashes, output hashes, an audit,
a semantic diff and the prepared publication files. It is a sealed record, not an
editable approval form. Files added/removed/changed after sealing invalidate it.

Raw source inventories are extracted independently of the importer: JSON records,
individual tree nodes/passives, Lua definitions or a whole-file hash when the
source has no recognized record structure. Local supplements are inventoried too.
A changed definition becomes a review issue even if the importer drops it and its
output remains unchanged. Individual record hashes are compared with previously
selected release records; the initial legacy baseline has no such raw inventory,
so its first capture requires a larger bootstrap review.

Generator ledgers add concrete dispositions for item modifiers/bases/unique
identities/augments, economy class exclusions, tree-node exclusions, skipped gem
skills/levels, partial translations/interpolation, and PoE2DB page coverage.
The candidate also enumerates output changes, generated diagnostics, missing
effects and removed comparison pages. Other inputs remain explicit raw-definition
review items rather than being assumed understood. This is coverage accounting,
not an automatic game-mechanics interpreter.

`review.json` contains:

- `candidateFingerprint`, `targetPatch` and a completed official patch-scope review.
- `sourceReviews`: one per affected feature/provider, with the exact hash printed
  by `groups`, target patch, reviewer, evidence, and `verified` or `not-affected`.
  Waiting/disputed/missing providers block the affected feature. Inputs used by an
  independent, unselected feature do not block it.
- `ledger`: relevant official patch changes, each with an ID, feature, description,
  official URL, reviewer, evidence and disposition. Verified entries select an
  exact artifact and JSON key path and assert `equal`, `contains`, or `absent`.
  Waiting/implementation-needed entries block. Explicit out-of-scope entries need
  developer review and a reason.
- `issueReviews`: explicit issue ID lists, reviewer, reason, evidence and
  `verified`, `not-applicable`, or `unsupported`. Unsupported scope requires the
  developer's review. Wildcards, missing/duplicate IDs and obsolete exceptions
  cannot pass. Batch genuinely related IDs with a specific, defensible explanation.
- `mechanics`: one entry per affected feature, `unchanged`, `changed`, or `new`,
  with evidence and agent review. Changed/new mechanics additionally require the
  developer's review and completed implementation before claiming support.

Example of a real field assertion (replace every value with investigated evidence):

```json
{
  "id": "announced-gem-effect",
  "feature": "gems",
  "officialUrl": "https://www.pathofexile.com/forum/view-thread/REAL_THREAD",
  "description": "Exact announced level-20 effect change",
  "status": "verified",
  "reviewer": "Agent name",
  "evidence": "Pinned skill definition and generated text inspected",
  "artifact": "public/gems/effects-v1/REAL_SKILL_ID.json",
  "path": ["sets", "1", "levels", "20", "lines"],
  "operator": "contains",
  "expected": "Exact expected effect text"
}
```

A passing `data:test` receipt is mandatory and tied to the same candidate. It runs
shared/domain tests in the isolated stage with two workers. These tests may need
intentional, evidence-backed changes for a balance patch; update tests in the
implementing checkout and regenerate. Do not edit staged tests to bypass a failure.
Domain test file readers resolve the selected release in prepared checkouts too,
so a subsequent `bun run test` does not silently test the legacy asset files.
Run the full repository test/typecheck/lint suites too when feature/backend code
changes; the candidate domain receipt does not replace backend/browser validation.

The gate verifies structured completeness, expected generated values, integrity,
required dependencies and recorded decisions. Reviewers still establish truth:
a fabricated evidence string or an omitted official change cannot be disproved
by a generic CLI. Never mark the scope complete until the patch notes and raw
changes have been reconciled. This is why manual developer/agent work remains
required for new systems and substantial mechanics changes.

## Publication and recovery

`data:prepare` requires a passing acceptance check and prepares checkout changes:

- Adds `public/data-releases/<release-id>/` without overwriting old assets.
- Archives generated shared tables, comparison/recipe/choice fixtures, and their
  previous values with the release.
- Adds an immutable `data/releases/<release-id>.json` repository record with source
  provenance, raw inventories, reviews, tests and runtime/generator versions. The
  small public `release.json` binds that record by SHA-256, keeping large audit
  records out of the website asset-size limit.
- Updates generated shared tables, then writes `shared/data-release.json` last.
- Retains each independent feature's selected release and original source records.

Preparation is reversible filesystem work, not deployment. Use an isolated review
checkout, especially if a development server is running. It refuses a changed
baseline selection/shared inputs and a conflicting existing release ID. Concurrent
preparations cannot share a staging directory. Commit/review the complete file set;
never deploy midway through preparation. The build verifies selected release
hashes, evidence records and prefix consistency, catching incomplete preparations and later edits.

Client/server readers resolve reference URLs through the same compiled selection;
JSON artwork references and React Query keys follow that selection. Reference
keywords use local frozen data only. Old namespaces remain available to cached
clients. Gem and item server requests carry the client's release identifier;
each immutable namespace archives its complete `selection.json`, including
features retained from earlier releases. Missing historical selections fail
explicitly rather than serving current metadata to an older client. The existing
legacy assets stay untouched; a default empty selection
continues to serve them until an approved candidate is prepared.

To undo the most recent preparation in the checkout:

```sh
bun run data:rollback --release <most-recent-release-id> --checkout /absolute/review-checkout
bun run data:verify --checkout /absolute/review-checkout
```

This restores the previous shared tables and feature selection and retains the
new assets for open sessions and investigation. It refuses to roll back an older
transaction over newer feature updates. Deployment rollback and database/schema
recovery remain separate operations in the runbook. No command clears exchange
history, resets a collector, migrates saved builds or activates a league.

## Rehearsal

```sh
bun run data:rehearse
# Optional: --out /absolute/new-rehearsal-directory
```

This uses injected currency metadata plus the existing frozen Atlas fixtures and
local artwork, real offline Python generation, domain tests both before and after
namespace selection, a deliberately blocked source review, acceptance, publication
preparation and rollback in temporary directories.
It performs no upstream requests or deployment. It retains a `rehearsal.json`
receipt and candidate files for inspection. Synthetic review entries are clearly
labelled and must never be copied into a real patch acceptance record.

Additional tests in `scripts/data-pipeline.test.mjs` cover staggered providers,
wrong expected values/new effects, unresolved mechanics, changed hashes,
uncaptured requests caught by an importer, and explicit accounting of unfamiliar
modifier domains/types. `shared/data-assets.test.ts` and the keyword browser tests
cover pinned definitions and immutable URL resolution. Rehearse again after
changes to capture, extraction, acceptance, asset selection or publication.
