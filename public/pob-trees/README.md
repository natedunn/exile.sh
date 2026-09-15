# PoE2 passive tree data

Game data © Grinding Gear Games. Derived from the versioned tree JSON distributed by PathOfBuildingCommunity/PathOfBuilding-PoE2. The source commit is recorded in each file; regeneration is in `scripts/build-tree-assets.py`. These assets contain names, descriptions and coordinates, not CDN icons. Existing version files must not be replaced; use a new asset revision if a patch changes a tree under an existing version label.

PoB source license is included in LICENSE-PoB.txt. The application is not affiliated with or endorsed by Grinding Gear Games.

The earlier additive `v2/` geometry revision was generated from the same pinned PoB source commit. This retains signed connection orbit geometry, preserves one-way connections, and excludes nonvisual class-start and cross-ascendancy links, following `src/Classes/PassiveTree.lua` connector rules. The original assets remain available. Main-tree and allocated ascendancy maps are framed separately. Node colors are presentation categories inferred from names/icons, not GGG category metadata.

Official node artwork is extracted from the same pinned PoB version's DDS arrays by `scripts/update-tree-art.py` (Python: Pillow and zstandard). `art-v2/` manifests reference content-hashed WebP icons, deduplicated across versions. Missing atlas entries retain their dot representation. The frontend fetches the manifest only on inspection or at 3× zoom, renders images only for visible zoomed nodes, and caches manifests in React Query. Cloudflare static `_headers` gives both the versioned geometry and artwork immutable one-year browser caching. Generate a new revision directory when changing either published dataset.

The standalone `/trees` explorer and Build Bin use `v4/` geometry (including keystone classification and excluding image-only decorations) and `art-v2/` artwork. `shared/tree-versions.ts` is the frontend version catalog; the explorer pins its selection in the URL. Only the selected snapshot is fetched. No database is required for these shared static assets.

To add a release, pin its upstream source commit in the generation scripts, add the version to the geometry generator’s version list, generate geometry and then artwork (which discovers the generated `v4/` snapshots), and add it to `shared/tree-versions.ts`. Run the tree asset tests and check the viewer before publishing. Preserve all historical snapshots. For corrections within an existing version, publish a new asset revision directory and update the corresponding fetch paths/cache keys; never overwrite an immutable URL. User-created allocations, if added later, should save the tree version alongside node IDs separately from the static tree data.

## Image-only decorations

The `v4/` geometry revision excludes nodes with the upstream `isOnlyImage` flag and any incident connections. These entries (for example, “Energy Shield Mastery”) describe decorative cluster images, not allocatable passives. The prior importer discarded the flag and rendered them as ordinary dots with empty tooltips. PoB classifies them as `OnlyImage` and excludes their connections in `src/Classes/PassiveTree.lua`.

Audit of all five snapshots at source commit `ce566eac45ea8a86477f513c7ee65a1ebe60014e`:

| Version | Image-only entries removed |
| ------- | -------------------------: |
| 0.1     |                        233 |
| 0.2     |                        250 |
| 0.3     |                        290 |
| 0.4     |                        348 |
| 0.5     |                        368 |

All other node data and connections are unchanged. Missing artwork is not a removal criterion: 0.5 node `11184`, “Zarokh's Gift,” has no icon but is explicitly an `isJewelSocket` with the stat “Sinister Jewel Socket” and is retained. It is the only remaining non-class-start node without artwork across these snapshots.

`scripts/build-item-node-references.py` generates individual item-allocation references under `node-reference-v1/`. These include named jewel sockets as well as notables. Missing artwork does not exclude a reference. The generator adds missing URLs and refuses to overwrite changed published records; full-tree and artwork indexes are not needed when inspecting an item allocation.

`shared/fixtures/pob/image-only-nodes.json` records the IDs independently extracted from the pinned upstream `src/TreeData/<version>/tree.json` files where `isOnlyImage` is true. Regression tests compare `v4/` to `v3/` using this fixture to ensure only those entries and their incident connections are removed. Earlier asset revisions stay immutable; both viewers now request `v4/` with a new query cache key.

## Paths Not Taken

The standalone viewer hides Oracle-exclusive Paths Not Taken nodes by default. Its checkbox reveals them with blue connections/outlines and labels their Oracle requirement in node details. The `unseen` URL option persists across reloads and fullscreen; it has no effect on pre-0.4 snapshots or ascendancy maps.

`scripts/update-tree-unseen.py` extracts IDs whose upstream `unlockConstraint.ascendancy` is `Oracle` and whose required node grants “Walk the Paths Not Taken.” The small `shared/generated/tree-unseen.json` metadata table uses the same pinned revision as the geometry. Both 0.4 and 0.5 contain 176 such nodes; 0.1–0.3 have none. Other unlock constraints, including the Sinister Jewel Socket, are not classified as Oracle paths. Regenerate this table when adding tree versions. Build Bin's saved allocations remain unchanged.

## Ascendancy backgrounds

`ascendancy-v1/` contains full-resolution circular GGG artwork extracted from the pinned PoB DDS arrays by `scripts/update-ascendancy-backgrounds.py` (Pillow and zstandard required). `shared/generated/ascendancy-backgrounds.json` maps each version and ascendancy to its artwork and upstream center/size. PoB's `DrawAsset` treats the recorded width and height as half-extents, so the generated dimensions are doubled. Backgrounds are decorative SVG images behind connections and nodes, using the same shared renderer in Trees and Build Bin. Publish a new asset revision for future source changes; game artwork belongs to Grinding Gear Games.

## Independently loaded ascendancy trees

`python3 scripts/build-ascendancy-assets.py` splits the pinned v4 geometry into `ascendancies-v1/<version>/<ascendancy>.json`, with a matching small artwork manifest pointing to existing shared icon files. `shared/generated/ascendancy-trees.json` provides selector labels and asset URLs without loading geometry. The shared `AscendancyTree` component fetches only the selected snapshot, caches it with React Query, and keeps its selector available while loading or retrying. Build Bin uses the same component with `showSelector={false}`. Keep published revisions immutable.

Abyssal Lich (0.3 onward) is represented upstream by `options["Abyssal Lich"]` overrides on Lich nodes rather than a separate base node list. Run `scripts/build-abyssal-lich.py` with Pillow and zstandard to materialize its alternate IDs, names, stats, icons, and remapped connections. Original geometry and shared nodes are preserved; `baseId` retains compatibility with PoB allocations. The pinned option fixture is stored in `shared/fixtures/pob/abyssal-lich-options.json`. The ordinary splitter preserves these additive variant entries.

`passives-v1/` contains main-only standalone explorer snapshots derived from
`v4/` by `python3 scripts/build-passive-explorer-assets.py`. These keep the same
main-tree coordinates, node IDs, and connections (including Unseen Paths), while
ascendancies load independently from `ascendancies-v1/` only when selected.
Publish a new revision when changing the inputs.
