# Genesis Tree

`v1` is a standalone snapshot of The Genesis Tree (Breach, Monastery of the Keepers) from RePoE's `BrequelTree` export. It contains 243 nodes across the Currency, Amulet, Ring, Belt, and Breachstone Wombs, and 239 connections. The export's five roots are unnamed, iconless anchors beside each Womb and are omitted, so each Womb roots its branch.

- Source: https://repoe-fork.github.io/poe2/passive_skill_trees/BrequelTree.json
- Frozen input: `shared/fixtures/genesis/BrequelTree.json`; its SHA-256 is recorded in `v1/tree.json`.
- Effects: the export lists stat IDs only. Node text comes from the English entries of RePoE's `stat_translations/stat_descriptions.json`, frozen in `shared/fixtures/genesis/stat-translations.json`. Stats without a game description are hidden in game and omitted.
- Choices: the 37 choice notables' options are frozen in `shared/fixtures/genesis/options.json`, sourced from https://poe2db.tw/us/The_Genesis_Tree on 2026-10-01. Each entry is tied to its node ID, name, and source stats.
- Artwork: mirrored from https://cdn.poe2db.tw/image/. Game data and artwork belong to Grinding Gear Games.

Run `python3 scripts/build-genesis-assets.py` to reproduce the geometry and mirrored artwork. It shares its layout with the Atlas builder (`scripts/repoe_tree.py`). Wombs carry no effects in the export, and the data has no passive point budget, so the viewer is view-only. For future updates, freeze new fixtures and publish a new asset revision instead of overwriting immutable files. All assets are served locally; browsing needs no third-party requests.
