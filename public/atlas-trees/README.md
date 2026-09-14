# Atlas passive tree

`v1` is a standalone Path of Exile 2 Atlas snapshot from RePoE's **4.5.5.2** export, not a historical character-tree version. It contains 537 playable/starting-point nodes and 586 connections. The 38 explicitly image-only decorations are excluded.

- Source: https://repoe-fork.github.io/poe2/passive_skill_trees/Atlas.json
- Frozen input: `shared/fixtures/atlas/Atlas.json`; its SHA-256 is recorded in `v1/tree.json`.
- Game artwork mirror: https://github.com/juddisjudd/atlas.exilecompass.com/tree/90c1873011d9ae53beb49419067e75e0b7ce2353/static/icons
- Game data and artwork belong to Grinding Gear Games. No application code from the artwork mirror is included.

Run `python3 scripts/build-atlas-assets.py` to reproduce the geometry and locally mirrored artwork. For future updates, freeze a new source fixture and publish a new asset revision instead of overwriting immutable files. Atlas history is independent of the character-tree version selector. All assets are served locally; browsing needs no third-party requests.

`v2` preserves v1 geometry and artwork and adds the 43 Atlas choice nodes' options.
The frozen supplement is `shared/fixtures/atlas/options.json`, sourced from
https://poe2db.tw/us/Atlas_passive_skill on 2026-09-13. Each entry is tied to its
node ID, name, source stats, and the original export hash. Multiline effects stay
within one choice; internal hidden stats are excluded. Revalidate this supplement
when changing the Atlas snapshot. This does not establish a public patch mapping.
The builder now emits v2 and reuses local v1 artwork without downloading it again.
