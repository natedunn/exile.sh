# Third-party data and artwork

Original exile.sh code is MIT-licensed. That license does not grant rights to Grinding Gear Games’ intellectual property.

- Exchange prices: Grinding Gear Games’ documented [Currency Exchange API](https://www.pathofexile.com/developer/docs/reference#currency-exchange).
- Item metadata: [RePoE fork](https://github.com/repoe-fork/repoe-fork), [PoE2 export](https://repoe-fork.github.io/poe2/base_items.min.json). `shared/catalog-source.json` records retrieval and SHA-256 provenance. `python3 scripts/update-catalog.py` refreshes the snapshot; review its diff and categories before committing.
- Game names, descriptions, and artwork belong to Grinding Gear Games. Item images are served from the community export’s artwork paths. Missing images receive a fallback icon. RePoE’s tooling license does not relicense game assets.
- Geist fonts are distributed through Fontsource under the SIL Open Font License. Dependency license files remain in their packages.
- Fontin is a font by Jos Buivenga ([exljbris](https://www.exljbris.com)), embedded under the [exljbris free font licence](https://www.exljbris.com/eula.html). It is not covered by this project’s MIT license and may not be redistributed separately.
- The exile.sh mark and interface are original project assets.

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

- Item registry: [Path of Building Community PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) base, unique and modifier definitions, combined with [RePoE PoE2 exports](https://repoe-fork.github.io/poe2/). `public/items/v1/source.json` records exact sources, revision, SHA-256 hashes and coverage limitations. `python3 scripts/update-item-registry.py` verifies the snapshot; `--refresh` intentionally replaces it. Game data and artwork retain Grinding Gear Games’ ownership.

- Modifier pool cross-check: per-class modifier pools from [PoE2DB](https://poe2db.tw/us/) by chuanhsing, captured by `scripts/snapshot-poe2db.py` into `scripts/data/poe2db-modifier-pools.json` with capture date and page URLs. Used only to verify the generated registry in tests, never as displayed data. Fetched within PoE2DB's robots.txt, one page at a time.
- Runeforging recipe relationships: [PoE2DB Runeforging](https://poe2db.tw/us/Runeforging) and explicit game-file recipe records published by [vaal.tools](https://www.vaal.tools/). Source URLs, review dates and local snapshot hashes are recorded with the registry. Only factual recipe relationships are retained.

The PoE2DB snapshots (`scripts/data/poe2db-modifier-pools.json` and `scripts/data/runeforging-recipes.json`) are not covered by this project's MIT license. They remain PoE2DB's compilation of Grinding Gear Games' data, included with attribution and non-commercially under PoE2DB's [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) terms: the modifier pools only to verify this project's data in tests, the recipe relationships as the factual upgrade paths shown on unique pages. Either will be removed on PoE2DB's request.
