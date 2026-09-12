# PoE 2 build sharing

`/builds` accepts a PoE2 export or a pobb.in link, renders a local preview, and publishes an immutable anonymous snapshot to `/builds/:uuid`. The original compressed export is retained for copy/download, including data that the current viewer does not interpret. No calculation engine or GGG API is involved. See [the spike](pob-sharing-spike.md) for the evidence and source inventory.

## Gem tooltip references

Skill and support tooltips show descriptions and numerical effects from the pinned PoB reference. `scripts/update-gem-effects.py` generates per-skill JSON using PoB's MIT-licensed `StatDescriber.lua` and its generated GGG descriptions; install `lupa` in a Python environment to run it. Lua runs only at asset-generation time, never on user input. The generator reads the gem-art catalogue's skill IDs, records source hashes in `public/gems/effects-v1/source.json`, and refuses to overwrite a published asset revision. Generate future updates under a new versioned directory.

Effects select the saved stat set and gem level, including its corruption level modifier. Quality contributions are listed separately using PoB's integer truncation. Equipment/passive bonuses and alternate quality bonuses are not calculated. Actor-level interpolated stats and unsupported translations are omitted and flagged; unknown levels do not silently fall back to another level. Existing snapshots recover gem metadata from their original PoB code when necessary.

References fetch only when a tooltip opens, with shared query caching and immutable HTTP cache headers. Long tooltips scroll within the space available beside their trigger. Tests cover Loyalty's two effect values, Spark's level/corruption/quality changes, alternate stat sets, unavailable references, mobile/desktop inspection, and lazy cached requests.

## Runtime and setup

The existing Convex provider and kitcn procedures are reused. Run `bun run dev` to initialize a worktree-local anonymous backend, sync schema/functions, and start the Portless route printed in the terminal. Use `bun run dev:shared` only when intentionally targeting the development deployment configured in `.env.local`. Cloudflare branch builds deploy backend changes to an isolated, branch-scoped Convex preview and build a matching Worker preview; the main-branch pipeline builds against and deploys the production Convex backend before publishing the frontend. Run `bun run codegen` if generated files need refreshing. Never point a preview at production.

The public `builds.create` mutation validates and parses on the server, checks slug uniqueness, and atomically enforces a global beta budget of 30 publishes per minute. The `builds.resolve` action accepts only HTTPS pobb.in paths, rejects redirects, limits the response body, times out, identifies the application, and uses a private mutation for a global 10-imports-per-minute budget. These global budgets are deliberately simple initial limits, not per-user abuse prevention. There are no editing, deletion, ownership, or discovery endpoints in this slice; links are public, not access controls.

Share-page loaders fetch Convex on the server, so titles and descriptions are available to link crawlers. The 1200×630 PNG is currently a shared branded card, not a personalized stats image. Copy-code and download work without a storage request.

## Data and rendering

The parser stores its own version, ordered skill/equipment/config sets, every tree spec's original version and string IDs, all exported player/minion stats, full-DPS entries, and plain-text notes. Missing and nonfinite values remain distinguishable from zero. Stats always describe the exported active setup and are not recalculated when a viewer browses another set. Only equipped items in the selected item set are shown; other items remain in the snapshot and original code. Item and jewel descriptions honor selected variant markers where supported and expose uncertain text rather than inventing a roll.

Tree maps for versions 0_1 through 0_5 are pinned local assets. `scripts/build-tree-assets.py` produces node coordinates, names, effects, and curved orbit connections. `scripts/update-tree-art.py` mirrors official node artwork into versioned local assets; images load on demand and are cached. The preview fits allocated nodes, opens a full-screen pan/zoom view, and keeps ascendancies below it. Desktop tooltips dismiss on leaving a node unless Alt/Option is held; touch and keyboard inspection remain available. Weapon-set allocations have a persistent color-vision palette selector.

The sidebar lists socketed jewels with artwork above allocated Keystone passives, followed by a base attribute summary. Attribute overrides from PoB identify the selected Strength/Dexterity/Intelligence choices. Dedicated attribute nodes, other passive bonuses, and percentage increases are separated; gear, jewel transformations, conditional bonuses, and character base attributes are not folded into these totals. Counts include allocations from both weapon sets, once per node. Unmapped nodes and missing choices are flagged.

Jewel radii and known radius effects are shown without a calculation engine. See [unique jewel coverage and limitations](unique-jewel-support.md). Unknown future tree versions preserve their original export and report the unavailable map. A version label alone cannot identify upstream changes published under that same label; pinned asset revisions preserve our chosen snapshot.

Skill groups stack in two responsive columns, with the selected main group first. Rows show gem art, tags, saved level/quality, corruption cues and indented supports. Numerical tooltip effects use the pinned base reference described above. Gem provenance is available from the section’s info button; broader sources and ownership are on `/methodology`.

## Validation

- Twenty real public PoE2 exports, with provenance, checked for decode/re-encode round trips and multiline paste handling.
- Synthetic empty, malformed, PoE1, entity, compression-framing, oversized-expansion, ordered-set and special-node cases.
- Convex-test checks create/read, immutability, invalid input, publishing limits, URL imports, foreign-origin rejection and oversized/unavailable responses.
- Browser tests cover desktop/mobile preview, auto-import status, keyboard navigation, equipment/gem inspection, tree pan/zoom and hotkeys, color palettes, jewels, and attribute summaries. Live publication and crawler retrieval can be smoke-tested against the configured development deployment.

Personalized share images, version history/diffs, item pricing, trade links, native `.build` exports, discovery and recalculation are follow-up features.

## Visual equipment viewer

Equipment now renders as an inventory layout with locally mirrored RePoE artwork. Rare items match their base type; named uniques match the unique-art catalogue first. Unknown bases and failed image loads retain a named, inspectable fallback. Weapon sets I/II switch the displayed weapons only; snapshot stats remain unchanged. Extra slots (such as additional rings or socketed items) remain accessible below the main layout.

Each item opens an accessible Base UI popover on hover or activation. Touch and keyboard users can open and dismiss the same card. Properties, requirements, socketed runes, modifiers and corruption are separated visually; unsupported PoB variant/range markers stay visible rather than silently selecting rolls. Original item text remains available in the card.

`shared/equipment-art-source.json` records hashes of the source metadata. `scripts/update-equipment-art.py` regenerates the catalogue and mirrors missing WebP assets into `public/equipment`. Pages lazy-load only their displayed gear. Existing mirrored files are retained by source path. Artwork © Grinding Gear Games.
