# PoE 2 build sharing

`/build-bin` (the Build Bin) accepts a PoE2 export or a pobb.in link, renders a local preview, and publishes an immutable anonymous snapshot to `/build-bin/:uuid`. The original compressed export is retained for copy/download, including data that the current viewer does not interpret. No calculation engine or GGG API is involved. See [the spike](pob-sharing-spike.md) for the evidence and source inventory.

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

Each item opens an accessible Base UI popover on hover or activation. Touch and keyboard users can open and dismiss the same card. Properties, requirements, socketed runes, modifiers and corruption are separated visually; unsupported PoB variant/range markers stay visible rather than silently selecting rolls. Clicking an item or its copy footer copies the original item export. Zero-quality rows are hidden; nonzero quality remains visible.

`shared/equipment-art-source.json` records hashes of the source metadata. `scripts/update-equipment-art.py` regenerates the catalogue and mirrors missing WebP assets into `public/equipment`. Pages lazy-load only their displayed gear. Existing mirrored files are retained by source path. Artwork © Grinding Gear Games.

## Tooltip structure

Rich item, gem, and passive tooltips share `InspectionTooltipContent` in `src/components/tooltip-pins.tsx`. It owns the popup shell, frozen positioning, pin/close controls, and persistent snapshots. `TooltipPinScope` owns pin limits and cleanup; tree targets retain their SVG anchor and pointer logic so pins follow pan/zoom.

- `src/inspection-tooltip.css` owns the shared frame, title, dither, scrolling defaults, hover interactivity, and pin controls. Content styles customize `--inspection-width`, `--inspection-max-height`, `--inspection-padding`, `--inspection-accent`, and `--inspection-border` instead of copying the shell.
- `useInspectionTooltip` owns DOM trigger hover, Alt hold, touch, and keyboard behavior for both equipment and gems. Spread its `popoverProps`, `triggerProps`, and `contentProps` onto the shared primitives. The tree keeps its SVG hit testing and supplies the same `data-hover-only` state to the shared shell.
- `ItemTooltipContent` renders item-specific content independently of the equipment grid: identity, property rows, requirements, augment groups, affix groups, and copy action. Item settings apply to live and pinned cards. Gem and passive content keep their domain-specific layouts.
- `ui/tooltip.tsx` remains the small, noninteractive label tooltip; `ui/popover.tsx` is the Base UI positioning primitive also used by ordinary popovers. These serve different accessibility roles from rich inspection cards.

Use the shared shell for future rich tooltips; put content-specific rules in the corresponding content stylesheet. Check equipment, skills, passive-tree, and tooltip-pins browser suites after changing shared behavior.

Augment effects are matched against `shared/augment-modifiers.json`, generated by `scripts/update-augment-modifiers.py` from the same pinned PoB revision as the gem catalogue. Exported numeric values are retained, including combined values for duplicate augments. Unknown effects remain in the augment section without a guessed source. Granted-skill artwork shares the gem catalogue query and resolves by unambiguous skill name.

Item tooltips support Alt/Option hold and **P** to freeze an open tooltip until dismissal. Granted-skill and anointment rows are nested Base UI popovers: hover, focus/Enter, or tap opens their details without dismissing the item. Escape dismisses the innermost popup first. `GemTooltipContent` is shared with gem rows; `PassiveNodeEffects` is shared with the tree. Anointments resolve node names and artwork against the active build's tree version, using the default version only when no version is supplied. Missing references retain the original modifier text and show an unavailable message.

Anointment tooltips fetch only their named nodes from `public/pob-trees/node-reference-v1`, not the full tree or artwork index. `scripts/build-item-node-references.py` generates these small records from the pinned local tree and artwork assets, with one record per unambiguous notable name and version. Each contains only its name, effects, choices, and image path; requests are deduplicated and cached by version/name. Regenerate after publishing new tree assets; changed records require a new reference revision. Only the dotted-underlined node/skill name triggers nested inspection; artwork and modifier prefixes remain ordinary content.

Gem names and underlying skill names can differ (for example, `Skeletal Warrior` versus the item-granted `Skeletal Warrior Minion`). `shared/gem-name-aliases.json` preserves source-declared alternate names keyed to stable skill IDs. Generate it with `python3 scripts/update-gem-name-aliases.py`; the generator verifies every input hash against the published gem catalogue provenance. `findNamedGem` prefers exact gem names, then resolves declared skill aliases while preserving support/active separation and rejecting ambiguous variants. Item artwork and nested details use that same resolver; no item-specific suffix stripping or fuzzy matching is used.

Skill groups preserve PoB's `source`, `removed`, `set1`, and `set2` attributes. Old snapshots recover missing group metadata from their saved export in the build view. Removed groups stay in the parsed array to preserve PoB's group indexes, but are excluded from the skill list before display. Item sources show their saved item name; explicit weapon-set flags take priority, with an item/default-attack weapon slot providing the set when flags are absent. Ordinary groups' legacy slots are not used to infer availability. Groups containing only supports receive an explanatory message and equal row styling. Distinct configured setups remain separate, and saved gem identities are not rewritten. Bare item-generated groups are shown as provenance on a single matching configured setup when their skill ID, level, quality, enabled state, and explicit set assignments agree. Ambiguous matches and item grants without a configured setup remain visible. Folding affects presentation only; source records and the main-skill selection are retained.
