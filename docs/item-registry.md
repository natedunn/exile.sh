# Item registry

`/items` is a public PoE2 reference catalogue. It has unique/base/type filters,
modifier-text search, progressive result loading, and links to individual item
pages. Search and catalogue filters survive detail navigation. Unique variant
selections are shareable URL parameters.

Item pages follow the gem and currency layout: a masthead with the item's
undithered art, then the item's own modifiers beside a ledger of its base stats,
requirements and tags. Unique modifiers show their roll ranges in parentheses.
Historical modifier lines are excluded from both display and search.
Multi-selection uniques such as Sunsplinter and Atziri's Splendour show
labelled alternatives as a reference; they do not pretend all their modifiers
belong to one item. Tabula Rasa's sockets are retained despite having no
explicit modifiers.

Below that, the modifier pool lists one table per source: base prefixes and
suffixes, desecrated prefixes and suffixes, essence prefixes and suffixes,
corruption implicits, Orb of Sacrifice upgrades, influence prefixes and
suffixes, and augments (runes, soul cores, idols, abyssal eyes). Unique pages
show corruption, Orb of Sacrifice and augments, using their base's tags. By
default each source's prefixes and suffixes sit side by side as CSS subgrids of
one grid, so matching rows share a height; a Layout control switches to stacked
tables and is remembered in local storage. Narrow screens always stack. Tables
filter by text and item level; modifier families collapse their tiers, with
tier one the highest required level. Eligibility uses base tags, and the first
matching tag wins, including an explicit exclusion. There are no probability
estimates: the exported eligibility values are not trusted as relative roll
weights.

Influences add a tag to the item (`soul`, `berserking`, …) that no base
carries. The tag comes from a warp rune ("Can roll Soul modifiers") socketed in
one slot, and the influence modifiers' own weights carry no item-class limit,
so the rune's slot is the gate: Soul (Medved's Tending) on body armour,
Berserking (Vorana's Carnage) on helmets, Decay (Katla's Gloom) and Marksman
(Kolr's Hunt) on gloves, Chronomancy (Uhtred's Sidereus) on boots, and
Destruction (Thrud's Might) on weapons. The importer reads these from the
augment export and stops if an influence has no rune. Within a rune's slot the
pool applies its own weights to the base's tags plus the influence tag, so
Soul's armour-type hybrids still follow the base.

"One of" essences (Enhancement, the Infinite) are display modifiers in PoB.
The importer expands each into the ordinary modifiers with exactly its roll
range on a matching stat, and pages keep the outcomes the base can roll:
Lesser Essence of Enhancement adds Energy Shield to an Intelligence base and
Armour to a Strength base. Outcomes that exist only on essences spawn on no
base by weight and are all kept. Orb of Sacrifice upgrades are RePoE's
`CorruptionUpgrade*` modifiers, filed under the unique generation type and
absent from PoB; their spawn weights are ordinary base tags. Roll ranges are
written low to high.

Tiers are grouped by modifier group and wording, so same-group alternatives at
one level stay separate rows. Lord tags (`ulaman_mod` and similar) follow
`default` in the exported eligibility and never change a result. Breach Genesis
Tree desecrations are excluded: their exported eligibility does not reflect
which items the tree can target.

Known gaps, each an accepted difference in the PoeDB cross-check below:
Alloys and the Essences of the Abyss and Delirium are missing (no item-class
mapping in the pinned sources); PoB names the global rather than local accuracy
modifier for Greater Essence of Battle (same text); and PoeDB omits augments
that target "Weapon" from martial weapons' socket lists while still granting
those weapons Destruction through Thrud's Might, a "Weapon" augment, so ours
keep them.

## Cross-check against PoeDB

PoeDB reads the game files independently of PoB and RePoE, so it checks how
the importer combines our sources. It is not a data source.
`scripts/snapshot-poe2db.py` captures PoeDB's per-class modifier pools (54
class pages, armour split by attribute) into
`scripts/data/poe2db-modifier-pools.json`, about 750 KB, with the capture date
and page URLs. `shared/item-registry-poe2db.test.ts` runs the item page's own
functions on a representative base per page and compares every pool:
modifiers by id where PoeDB has one, base and desecrated modifiers by affix
name, level, group and roll numbers. It runs offline in `bun run test`.

Every difference must be fixed or listed in
`scripts/data/poe2db-accepted-differences.json`. An entry names its pages
explicitly (no wildcards), its pool, side and modifiers, a reason a reviewer
can judge, evidence for verifying it, and a review date. The test fails on an
unlisted difference, on an entry without a reason or evidence, and on an entry
whose difference no longer occurs, so the list only holds what is still true.

Entries are claims. Whoever investigates a difference writes its reason, and
the owner reviews it before it is committed. Fixing the data comes first; a
difference nobody can explain stays failing and is raised, never listed.

## Data and refresh

To refresh, run `bun run items:refresh`. It imports changed sources
(`update-item-registry.py --refresh`), captures PoeDB again, and runs the
cross-check, writing paste-ready drafts for any unexplained difference to
`scripts/data/poe2db-draft-differences.json` (ignored by git). Drafts have
blank reasons and silence nothing until investigated.

Run `python3 scripts/update-item-registry.py` from any directory. It uses only the
Python standard library. `public/items/v1/source.json` records the pinned PoB
revision, exact RePoE URLs, SHA-256 hashes, counts, excluded unique diagnostics,
and coverage limitations. Normal runs verify the cached/downloaded sources
against the manifest. To deliberately import changed sources, run with
`--refresh`, review the generated diff, and run the registry tests.

The importer uses visible PoB base definitions, hidden Runeforged/Runemastered
definitions, and released RePoE metadata,
matching tags to avoid inherited entries with the same name. Duplicate definitions
are resolved by implicit text and defense properties; unresolved matches are
excluded with diagnostics rather than borrowing another form’s stats. PoB's extra genesis
tree tags are ignored during that match. Distinct same-name bases receive a
metadata suffix in their slug. Unique slugs include the base name so the three
Grand Spectrum jewels remain distinct.

PoB supplies base implicits and requirements, including granted skills and charm
slots that are missing from RePoE's generic implicit-modifier list. RePoE supplies
base properties, art, and structured modifier rules; PoB supplies missing Ward; modifier IDs are intersected
with the pinned PoB modifier files. Unique text and version/variant rules come
from PoB, with names and art checked against RePoE's unique catalogue. Unknown
modifier markup stops an import rather than silently stripping it.

Essences come from PoB's `Essence.lua`, which names the modifier each essence
adds per item class; modifier text and affix come from RePoE. Essence display
modifiers ("one of" outcomes) have no generation type, so the importer fixes
their affix. Augments come from RePoE's `augments.min.json`; its slot names
("Martial Weapon", "Armour") are mapped to catalogue item classes in the
importer and shipped as `augmentSlots`. Unresolved essence and augment entries
are recorded in `source.json`. Sources new to the importer have no recorded hash
until the next run records one.

The catalogue and modifier pool are separate assets. Search loads the catalogue;
base detail pages lazily load modifiers. Both are cached by React Query. Results
are initially bounded to 60 rows. The server reads the same catalogue through
ASSETS for item metadata and 404s; it is not bundled into application JavaScript.

PoB and RePoE snapshots are independent, and neither release flags nor presence
in a planner establish current league availability. This catalogue is a
reference snapshot, not an exhaustive, verified live-game catalogue. Unmatched
uniques are listed in the manifest. Unsupported conditional pools and special
acquisition rules remain outside this first implementation.

## Runeforging references

The snapshot includes 528 Runeforged and 246 Runemastered bases, with Ward,
requirements, changed defenses and implicit modifiers. Same-name variants keep
distinct identities, including Runic Fork and Grasping Mail alternatives. A form
switch heads the stats ledger: on base pages it links between the Original,
Runeforged and Runemastered pages of one name, and the ledger shows each stat's
change from the original form, as gem pages show level changes. Same-name
alternatives fall back to a select. Similarity is explicitly not a recipe claim.

230 uniques have connected, verified base upgrade paths. On unique pages the
switch only offers outputs of those paths, lists them with the recipe source,
and persists the choice in the `baseForm` URL parameter; the ledger
and modifier pool follow it. It shows unmodified base values, not computed final
unique stats. The original
unique modifier reference remains separate: transformed unique implicit lists,
cultivation and quality scaling are not assembled by this feature.

`scripts/data/runeforging-recipes.json` is a factual snapshot of published unique
recipe rows from PoE2DB’s Runeforging page, captured on 2026-10-01 through the
browser. The importer resolves exact names only when both identities are
unambiguous, and records unresolved or disconnected recipes in `source.json`.
`scripts/data/unique-runeforging.json` contains explicit metadata-ID mappings
cross-checked against vaal.tools’ game-file recipe tables for Double Vision,
Necromantle and Candlemaker. These mappings take precedence over name joins.

Refresh recipe snapshots separately from `--refresh`: review the published recipe
rows and replace the snapshot, retaining source URL and review date. Base-name
similarity must never create a unique upgrade path. Both local snapshot hashes
are recorded in the generated manifest. Missing recorded paths do not imply an
item cannot be upgraded; 59 unresolved published paths remain in diagnostics.

## Next: valid item designs

This release does not assemble rare items or validate crafting reachability.
Before enabling an item designer, add a versioned rules engine covering rarity
and item-class affix limits, groups, added tags, special modifier sources, item
states, and source compatibility. Verify that at least one valid acquisition
sequence can produce a proposed item, including applicable drop-only starting
states. Unknown combinations must remain unverified rather than be labelled
possible.

Only after that validation exists should an AI-assisted route planner propose
steps. Return structured actions and replay them through the same rules engine.
Cost and probability estimates require separately sourced weights and should
not be inferred from the boolean eligibility export.

## Validation

- `bunx vitest run shared/item-registry.test.ts shared/item-registry-poe2db.test.ts`
- `bun run typecheck`
- `bun run lint`
- `PLAYWRIGHT_BASE_URL=<running-worktree-url> bunx playwright test e2e/item-registry.spec.ts`

Keep the running development server intact. Production build validation belongs
in an isolated checkout while a development server is running.
