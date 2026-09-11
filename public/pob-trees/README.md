# PoE2 passive tree data

Game data © Grinding Gear Games. Derived from the versioned tree JSON distributed by PathOfBuildingCommunity/PathOfBuilding-PoE2. The source commit is recorded in each file; regeneration is in `scripts/build-tree-assets.py`. These assets contain names, descriptions and coordinates, not CDN icons. Existing version files must not be replaced; use a new asset revision if a patch changes a tree under an existing version label.

PoB source license is included in LICENSE-PoB.txt. The application is not affiliated with or endorsed by Grinding Gear Games.

The viewer now uses the additive `v2/` geometry revision from the same pinned PoB source commit. This retains signed connection orbit geometry, preserves one-way connections, and excludes nonvisual class-start and cross-ascendancy links, following `src/Classes/PassiveTree.lua` connector rules. The original assets remain available. Main-tree and allocated ascendancy maps are framed separately. Node colors are presentation categories inferred from names/icons, not GGG category metadata.

Official node artwork is extracted from the same pinned PoB version's DDS arrays by `scripts/update-tree-art.py` (Python: Pillow and zstandard). `art-v2/` manifests reference content-hashed WebP icons, deduplicated across versions. Missing atlas entries retain their dot representation. The frontend fetches the manifest only on inspection or at 3× zoom, renders images only for visible zoomed nodes, and caches manifests in React Query. Cloudflare static `_headers` gives both the versioned geometry and artwork immutable one-year browser caching. Generate a new revision directory when changing either published dataset.
