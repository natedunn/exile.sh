# PoE2 build sharing spike

## Decision

Proceed with a snapshot renderer; no calculation service is needed. Inspected 20 public PoE2 exports linked from the upstream issue tracker, plus upstream Build.lua. These were existing desktop exports, not newly exported by a locally installed client. Every sampled export contains 101–107 PlayerStat entries, including populated defensive and offensive stats. Zero DPS can be legitimate when the selected skill does not deal damage. Missing, zero, and infinite values must remain distinct. These are author-supplied snapshots, not verified calculations.

## Format findings

The root is PathOfBuilding2. Build carries level, className, ascendClassName and mainSocketGroup (one-based within the active skill set). targetVersion is 0_1 even in newer exports: it is NOT the passive tree version. Tree/Spec@treeVersion is the correct asset version; preserve every ordered spec and its string node IDs (some end in `c`). Skills/SkillSet and Items/ItemSet have independent active IDs. Skill@slot may associate a group with equipment; many PoE2 groups have no slot. ItemSet/Slot@itemId references Items/Item@id. Config can contain named ConfigSet collections with an active ID. Preserve config inputs and show them beside snapshot stats. Changing a viewed set cannot recalculate stats.

## Dependency evaluation

pob-parser 1.0.2 (MIT) was inspected from its npm tarball. It only decodes/encodes XML, does not parse a typed build, only supports zlib framing, and accumulates decompressed bytes without a bound. Use a bounded codec and a maintained XML parser instead. poe2-build-forge is MIT and has useful conversion fixtures, but conversion to the native planner is outside this first slice. pasteofexile is AGPL-3.0; its data model was read as reference, no code copied. Its README requests an identifying User-Agent, not browser impersonation.

## Sample inventory

| Source                       | Class     | Ascendancy          | Level | Stats | Nonzero | Tree versions | Specs |
| ---------------------------- | --------- | ------------------- | ----- | ----- | ------- | ------------- | ----- |
| https://pobb.in/-TeCx6SJiuWv | Ranger    | None                | 1     | 101   | 36      | 0_5           | 1     |
| https://pobb.in/0tdNirLOI5ll | Witch     | Lich                | 1     | 103   | 50      | 0_5           | 1     |
| https://pobb.in/1NIoh2Be6w2p | Ranger    | Pathfinder          | 94    | 106   | 73      | 0_5           | 1     |
| https://pobb.in/1oMAVH1Zttgz | Monk      | Invoker             | 97    | 103   | 60      | 0_5           | 1     |
| https://pobb.in/2k0EPn6QOhTx | Druid     | Shaman              | 90    | 103   | 56      | 0_5           | 2     |
| https://pobb.in/6Tbj-m4lgdxs | Sorceress | Stormweaver         | 54    | 103   | 46      | 0_5           | 1     |
| https://pobb.in/6ptZVK6KOCxH | Mercenary | Gemling Legionnaire | 93    | 106   | 60      | 0_5           | 1     |
| https://pobb.in/70HXySRg9wV5 | Ranger    | None                | 25    | 102   | 46      | 0_5           | 1     |
| https://pobb.in/7m3OySb6VYtd | Ranger    | Pathfinder          | 74    | 105   | 60      | 0_5           | 1     |
| https://pobb.in/B-iYfZBN_50L | Monk      | Martial Artist      | 93    | 102   | 65      | 0_5           | 1     |
| https://pobb.in/CI4hChFipObn | Mercenary | Gemling Legionnaire | 97    | 103   | 71      | 0_5           | 1     |
| https://pobb.in/CZfC5voLQXWp | Ranger    | Pathfinder          | 94    | 107   | 74      | 0_5           | 1     |
| https://pobb.in/FxGea2RhOoqd | Witch     | Infernalist         | 97    | 107   | 63      | 0_5           | 2     |
| https://pobb.in/Igv-YtdqJ4qk | Monk      | Invoker             | 98    | 105   | 60      | 0_5           | 1     |
| https://pobb.in/Mu3PxErdMKiE | Sorceress | Stormweaver         | 96    | 104   | 53      | 0_5           | 1     |
| https://pobb.in/QjGswnB0uMw3 | Huntress  | Spirit Walker       | 80    | 103   | 47      | 0_5           | 1     |
| https://pobb.in/R09ZhxGeretC | Ranger    | Pathfinder          | 97    | 106   | 73      | 0_5           | 1     |
| https://pobb.in/RwdBjzKwEoOm | Mercenary | Gemling Legionnaire | 91    | 107   | 58      | 0_5           | 1     |
| https://pobb.in/SKxx-DkaI_I5 | Witch     | Infernalist         | 23    | 106   | 49      | 0_5           | 2     |
| https://pobb.in/VmoLNcYh04kO | Ranger    | None                | 26    | 103   | 52      | 0_5           | 1     |

## Sources

- https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/dev/src/Modules/Build.lua (Save serializes mainOutput into PlayerStat, MinionStat, FullDPSSkill)
- https://github.com/Dav1dde/pasteofexile (LICENSE, README, pob/src/serde/model.rs)
- https://github.com/chesler410/poe2-build-forge (LICENSE and core fixtures)
- https://registry.npmjs.org/pob-parser/1.0.2

Fixtures retain original codes for lossless round-trip tests. Public issue examples may intentionally expose PoB bugs; that makes them useful compatibility fixtures, not endorsed build recommendations. Fetching stopped at upstream rate limiting.
