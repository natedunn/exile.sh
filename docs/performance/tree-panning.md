# Passive-tree panning measurements

Measured locally in Chrome through Playwright against the Vite development server, at 1440 × 900. Each scenario uses three runs, with warmed artwork, 120 pointer moves along the same curve, and zoom fixed at 3.375× or 7.59375×. Before and final-after measurements ran without concurrent browser tests. This is a development-browser comparison, not a production FPS guarantee.

| Metric (median of three runs) | 3.375× before | 3.375× after | 7.594× before | 7.594× after |
| ----------------------------- | ------------: | -----------: | ------------: | -----------: |
| Scripted gesture duration     |      7,049 ms |     2,413 ms |      2,223 ms |     2,115 ms |
| Traced FunctionCall time      |      3,376 ms |       518 ms |        706 ms |       236 ms |
| Traced Paint time             |      1,056 ms |       786 ms |        314 ms |       122 ms |
| rAF frame interval, p95       |       16.8 ms |      16.8 ms |       16.7 ms |      16.8 ms |
| Frame intervals over 25 ms    |            15 |            3 |             0 |            2 |
| SVG elements at gesture end   |        16,408 |       15,886 |        12,952 |        2,830 |
| Image elements at gesture end |           997 |        2,208 |           133 |          383 |

At the dense, medium zoom level, FunctionCall time fell 85%, Paint time fell 26%, and long frame intervals fell from 15 to 3 per scripted gesture. At higher zoom, JavaScript and painting cost decreased substantially, though frame timing was already near 60 Hz and did not improve; two occasional long intervals appeared in the optimized runs. Trace categories can nest and must not be summed as independent CPU totals. Gesture duration includes automation/input scheduling, so its reduction is not an FPS multiplier.

The shared renderer batches drag deltas through requestAnimationFrame and updates the SVG viewBox directly, committing React state when the camera exits a buffered region or the gesture finishes. Paths, artwork, and hit targets outside that region are omitted. Conservative arc bounds retain connections whose endpoints are outside the viewport. Inspection uses a separate lightweight anchor that remains mounted when the inspected node leaves the rendering buffer. Full-tree framing and camera constraints still use complete geometry; visibility toggles do not reframe the camera.

The buffer intentionally retains extra offscreen images. A smaller buffer reduced element counts further but caused more frequent mounting spikes. Translating a promoted SVG compositor layer also performed worse in this browser and was removed. The retained approach balances memory, paint cost, and fewer React commits without changing tree presentation.

Run with a local server already running:

```sh
node scripts/measure-tree-pan.mjs /tmp/tree-pan.json
```

`PLAYWRIGHT_BASE_URL` can provide the full passive-tree page URL; `TREE_PERF_RUNS` changes repetitions (default 3). Raw runs are in `tree-pan-before.json` and `tree-pan-after.json`. Functional checks cover Trees and Build Bin, mobile widths, inspection, geometry, camera persistence, and visible-node coverage after a buffered pan.

## Connection batching

A subsequent pass combines connections by stroke treatment: ordinary unallocated, Unseen Paths, shared allocated, weapon set 1, and weapon set 2. Every original `M…L…`/`M…A…` segment is retained as an independent subpath, including round caps. The three allocated glow/core layers retain their widths and group opacity. This caps connection elements at 11 (two unallocated paths plus three allocated colors across three layers); nodes, hit targets, and jewel overlays remain separate.

Fresh before/after runs used the same development-browser harness above, after the camera optimization. Medians of three runs:

| Metric                      | 3.375× before | 3.375× batched | 7.594× before | 7.594× batched |
| --------------------------- | ------------: | -------------: | ------------: | -------------: |
| Traced Paint time           |        855 ms |         649 ms |        157 ms |         105 ms |
| Traced FunctionCall time    |        520 ms |         490 ms |        239 ms |         234 ms |
| SVG elements at gesture end |        15,886 |         13,263 |         2,830 |          2,313 |
| rAF frame interval, p95     |       16.8 ms |        16.8 ms |       16.8 ms |        16.8 ms |
| Frame intervals over 25 ms  |             1 |              2 |             2 |              2 |

Paint time decreased 24% at medium zoom and 33% at high zoom. Frame timing was essentially unchanged; this provides rendering headroom rather than a demonstrated FPS increase. Raw runs are in `tree-batch-before.json` and `tree-batch-after.json`.

## Canvas prototype

The Canvas experiment has been removed following the memory comparison below. These results describe the historical prototype; SVG is the sole renderer. The profiling scripts now measure SVG only.

Connections and artwork use reusable 512 CSS-pixel tiles at native device-pixel ratio. Repeated nodes share pre-clipped sprites, including borders. Least-recently-used tiles are evicted, capping retained tile backing stores at 32 million pixels (~128 MB), in addition to the visible canvas, decoded images and sprites. Image loading invalidates only affected tiles; zoom, data and palettes invalidate their caches. Pending callbacks and resources are released on unmount. Raster placement snaps to device pixels to prevent tile seams, differing from SVG anchor positions by at most half a device pixel.

In the historical hybrid prototype, stable, memoized SVG hit targets retained inspection, keyboard handling and hover rings. Canvas panning updated both cameras directly without React commits until the gesture ended. Both renderers shared tree data, radii, camera constraints, artwork loading, connection grouping and palette tokens. That Canvas implementation has since been removed.

An early full-buffer experiment exposed long-drag pauses. Tiling limits raster work to newly exposed regions; tracing also identified development React work refreshing thousands of hit targets. Keeping those targets stable removed that burst.

### Final measurements

Fresh comparisons used Chrome/Vite development, 1440 × 900 CSS pixels, warmed artwork and 120 pointer moves. Each regular scenario ran three times sequentially, without concurrent tests. Tables show medians of three runs. Frame sampling includes initial pointer positioning and two frames after release, capturing entry/settling hitches as well as movement. p99 and worst-frame reporting were added because p95 alone hid occasional large pauses. These are development measurements, not production or 120 Hz guarantees; 4× CPU throttling is synthetic, not a specific device.

DPR 1, without throttling:

| Metric                        | 3.375× SVG | 3.375× Canvas | 7.594× SVG | 7.594× Canvas |
| ----------------------------- | ---------: | ------------: | ---------: | ------------: |
| Traced FunctionCall time (ms) |        549 |            93 |        257 |            76 |
| Traced Paint time (ms)        |        688 |           179 |        124 |            77 |
| rAF interval p95 (ms)         |       16.8 |          16.7 |       16.8 |          16.7 |
| rAF interval p99 (ms)         |      216.8 |          16.8 |       66.7 |          16.8 |
| Intervals over 25 ms          |          2 |             0 |          2 |             0 |
| SVG elements                  |      13263 |          3942 |       2313 |          3942 |

At medium zoom, traced Paint time fell 74% and FunctionCall time fell 83%; at high zoom, 38% and 70%. Canvas and SVG distribute work differently across trace categories, which can also overlap: these are not total GPU-cost or FPS multipliers. Fewer observed long frame intervals provide stronger evidence for smoother interaction. The worst normal-run interval across all three runs was 333.3 ms for SVG versus 66.7 ms for Canvas at medium zoom, and 133.3 ms versus 33.3 ms at high zoom. Occasional slow frames remain.

DPR 2, with Chrome 4× CPU throttling:

| Metric                        | 3.375× SVG | 3.375× Canvas | 7.594× SVG | 7.594× Canvas |
| ----------------------------- | ---------: | ------------: | ---------: | ------------: |
| Traced FunctionCall time (ms) |       3594 |           298 |        989 |           328 |
| Traced Paint time (ms)        |       3588 |           428 |        633 |           212 |
| rAF interval p95 (ms)         |       33.4 |          16.8 |       16.8 |          16.8 |
| rAF interval p99 (ms)         |       50.1 |          33.4 |      266.7 |          33.4 |
| Intervals over 25 ms          |        120 |             3 |          3 |             2 |
| SVG elements                  |      13263 |          3942 |       2313 |          3942 |

The stress test's worst medium-zoom interval across the three runs was 2,050 ms for SVG versus 66.7 ms for Canvas. This emphasizes development React overhead and must not be presented as expected production behavior.

A separate long-drag diagnostic doubled horizontal travel to 560 px at 3.375×, DPR 2, and 4× throttling, crossing cache boundaries. This was one run per renderer, not a statistical estimate:

| Metric               |        SVG |  Canvas |
| -------------------- | ---------: | ------: |
| p95 frame interval   |    33.4 ms | 16.8 ms |
| p99 frame interval   | 1,016.6 ms |   50 ms |
| Worst interval       | 1,349.9 ms | 50.1 ms |
| Intervals over 25 ms |         32 |       2 |

Canvas prepared four new tiles during the diagnostic. Their measured JavaScript preparation time peaked at 2 ms, excluding GPU completion. Regular runs needed no additional tiles during the gesture. The raw `cacheBuilds` field now counts tile preparations.

Raw results: `tree-canvas-before.json`, `tree-canvas-after.json`, `tree-canvas-stress-before.json`, `tree-canvas-stress-after.json`, `tree-canvas-boundary-before.json`, and `tree-canvas-boundary-after.json`.

### Verification and trial scope

All five Canvas browser scenarios passed: native-DPR artwork and camera alignment after long pans, inspection/Alt pinning/keyboard handling, Unseen Paths, mobile/fullscreen resizing, SVG selection, unavailable-context fallback, Build Bin integration and all five palettes, jewel fallback, and unchanged Atlas/Ascendancy rendering. Pixel checks verify artwork follows hit targets; palette checks compare actual canvas pixels. Retina screenshots were inspected against SVG; antialiasing differs slightly.

The combined 25-scenario browser run had 24 passes and one failure in the existing mobile version-picker keyboard test; that unchanged test passed on an isolated rerun. TypeScript, targeted ESLint, and all five connection/visibility unit tests passed.

SVG is the sole current renderer; no broader renderer migration is part of this change. Production profiling on actual target browsers and displays remains useful. The results above document the removed Canvas prototype, not the current implementation.

Reproduce with a running local server:

```sh
PLAYWRIGHT_BASE_URL='http://127.0.0.1:4173/trees/passive' node scripts/measure-tree-pan.mjs /tmp/svg.json
TREE_PERF_DPR=2 TREE_PERF_CPU=4 node scripts/measure-tree-pan.mjs /tmp/svg-stress.json
```

`TREE_PERF_RUNS` defaults to 3, `TREE_PERF_ZOOM_CLICKS` to `3,5`, and `TREE_PERF_DISTANCE` to 280. Use `TREE_PERF_ZOOM_CLICKS=3 TREE_PERF_DISTANCE=560` for the longer medium-zoom drag. `TREE_PERF_TRACE=/tmp/trace.json` optionally saves the final run's raw Chrome trace.

## Memory follow-up

The separate [memory comparison](tree-memory.md) found a meaningful additional browser footprint for Canvas, including on phone-size viewports. The speed improvements do not establish low-RAM suitability; The experiment was removed and SVG retained to avoid this additional memory cost.

## SVG hover isolation

The visible geometry no longer depends on the inspected node. Artwork is a memoized layer with stable visibility, allocation, jewel, and image inputs. Tooltip positioning uses its own noninteractive SVG anchor so a held inspection survives camera culling without invalidating the tree layers. The shared TreeMap applies this to standalone trees and Build Bin.

A targeted Chrome development check instrumented Geometry and Artwork function entries in the served module (no counters in application code). After artwork loaded at 3.375× in a 1440×900 viewport, switching inspection across 20 nodes produced **0 additional Geometry calls and 0 additional Artwork calls**. Moving the camera afterward did invoke both layers, confirming the instrumentation was active. The held tooltip also survived its target leaving the rendering buffer and dismissed on Alt release. This verifies skipped rendering work; it is not an FPS benchmark or a before/after frame-time comparison.

## Stable SVG regions

Node geometry and artwork now use fixed 1,200-unit world-space regions, built once per source node array. Each node belongs to one region. Visibility selects existing region objects and arrays; memoized node and artwork components retain their React subtrees while neighboring regions mount or unmount. Region bounds include 128 units for artwork and hit targets, and there is no clipping at region edges. Connections retain the existing global style batches and conservative arc visibility bounds, preserving whole curves and group glow opacity. Tooltips keep their independent anchor. The shared renderer applies the change to Build Bin, Passive, Atlas, and Ascendancy trees.

A development-only instrumentation check observed 147 regions retained, 47 entering, and 59 exiting during a vertical camera move. Retained NodeRegion and Artwork components executed **zero** additional times. Twenty subsequent inspection changes also executed zero region renders. Instrumentation was injected into the served module by Playwright; no render counters were added to application code.

### Boundary-crossing measurements

Same Chrome/Vite development server, 1440×900 viewport, 560-pixel horizontal sinusoidal travel and 100-pixel vertical travel over 120 mouse moves. Three runs per zoom/configuration, all baseline runs before implementation and all after runs afterward. Normal: DPR 1, no CPU throttle. Stress: DPR 2, 4× CPU throttle. Values below are medians across the three runs; these are desktop simulations, not measurements on low-RAM hardware. No full test suite was run.

| Configuration | JS FunctionCall ms, before → after | Paint ms, before → after | p95 frame ms, before → after | p99 frame ms, before → after | Intervals >25 ms, before → after |
| ------------- | ---------------------------------: | -----------------------: | ---------------------------: | ---------------------------: | -------------------------------: |
| Normal 3.375× |                          666 → 410 |                587 → 478 |                  33.2 → 16.8 |                  166.7 → 100 |                            7 → 6 |
| Normal 7.594× |                          284 → 168 |                  94 → 75 |                  16.8 → 16.8 |                    50 → 16.8 |                            4 → 0 |
| Stress 3.375× |                        3195 → 1802 |              2738 → 1850 |                  33.4 → 33.3 |                633.4 → 250.1 |                          62 → 21 |
| Stress 7.594× |                         1150 → 641 |                396 → 326 |                  16.8 → 16.8 |                  250 → 133.3 |                            7 → 6 |

JavaScript FunctionCall totals fell 38–44%. Stress medium-zoom p99 fell from 633.4 to 250.1 ms; normal high zoom had no intervals over 25 ms in any of the three new runs. This is reduced hitching, not a claim of an equivalent percentage FPS increase. Stress high-zoom p95 remained 16.8 ms in the median, with one new run at 33.3 ms; slow intervals were not uniformly improved in every run. Worst observed intervals across all runs were 216.7 → 133.3 ms (normal medium), 50.1 → 16.8 ms (normal high), 966.6 → 616.6 ms (stress medium), and 349.9 → 166.7 ms (stress high). Trace categories can overlap and do not measure total GPU execution time.

**DOM tradeoff:** whole regions retain extra offscreen content. At the end of the measured drag, medium zoom increased from 12,748 to 15,380 SVG elements (+20.6%; images 2,122 → 2,492); high zoom increased from 2,284 to 3,450 (+51.1%; images 378 → 556). Region arrays contain references to existing nodes; there is no new raster cache. The subsequent [region memory audit](tree-regions-memory.md) measured the additional footprint: tens of MiB, including up to 41.7 MiB at a matched stage. The extra DOM does not have zero memory cost.

Raw results: `tree-regions-before.json`, `tree-regions-after.json`, `tree-regions-stress-before.json`, and `tree-regions-stress-after.json`.

Validation includes region ownership and padded bounds, conservative crossing arcs, duplicate-free visible node coverage after panning, retained tooltip inspection after culling, desktop and mobile interaction, jewel artwork, and weapon palettes. Screenshot inspection found continuous connections across region boundaries.

## Node paint follow-up

The subsequent [node paint batching comparison](tree-node-batching.md) reduced mounted SVG elements by about 60% while preserving the same artwork and hit targets. It includes frame-time measurements, a memory spot check, and visual/interaction validation.
