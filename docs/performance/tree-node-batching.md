# SVG node paint batching

Node backgrounds and border rings now share SVG paths within each stable region. Individual circular hit targets, artwork images, image clips, hover rings, and tooltip anchors remain. Both standalone Trees and Build Bin use the change.

Compatible discs are grouped by allocation, weapon set, or Unseen Paths style. Each circle is an independent closed two-arc subpath starting at its rightmost point, preserving the phase of dashed allocated rings. Stroke width, opacity, palette tokens, and non-scaling strokes retain their previous values. Contiguous paint runs contain only non-overlapping discs; overlap checks include border extents in world units. When discs overlap, a new run preserves the original stacking order and alpha compositing. There is no Canvas renderer or bitmap cache.

## Panning results

Chrome/Vite development server, 1440×900 viewport, 560-pixel horizontal and 100-pixel vertical sinusoidal drag, 120 mouse moves. Three runs per zoom and configuration before, then three afterward. Normal is DPR 1 with no CPU throttle; stress is DPR 2 with 4× CPU throttle. Values are medians across three runs. Comparisons start from the preceding stable-region implementation, including hover isolation and connection batching.

| Configuration | FunctionCall ms, before → after | Paint ms, before → after | p95 frame ms, before → after | p99 frame ms, before → after | Intervals >25 ms, before → after |
| ------------- | ------------------------------: | -----------------------: | ---------------------------: | ---------------------------: | -------------------------------: |
| Normal 3.375× |                       400 → 305 |                454 → 210 |                  16.8 → 16.8 |                     100 → 50 |                            6 → 2 |
| Normal 7.594× |                       165 → 118 |                  79 → 55 |                  16.7 → 16.8 |                  16.8 → 16.8 |                            0 → 0 |
| Stress 3.375× |                     1850 → 1268 |               1874 → 988 |                  33.3 → 16.8 |                  266.6 → 150 |                          18 → 11 |
| Stress 7.594× |                       648 → 475 |                318 → 192 |                  33.3 → 16.8 |                 133.4 → 66.7 |                            7 → 5 |

JavaScript FunctionCall totals fell 24–31%; Paint totals fell 30–54%. Normal high zoom was already at roughly 60 Hz and remained there. Stress high zoom still had one run with p95 33.3 ms and nine intervals over 25 ms; not every run improved uniformly. Trace categories can overlap and exclude some GPU work, so these reductions are not equivalent FPS multipliers. This desktop simulation does not establish performance on physically low-powered devices or a production build.

| End-of-drag SVG contents    | Before |          After |
| --------------------------- | -----: | -------------: |
| Medium zoom, total elements | 15,380 | 6,055 (−60.6%) |
| Medium zoom, artwork images |  2,492 |          2,492 |
| High zoom, total elements   |  3,450 | 1,378 (−60.1%) |
| High zoom, artwork images   |    556 |            556 |

## Memory spot check

One fresh isolated Chrome session before and one after for each profile, six sessions total. Same existing traversal/GC/memory-infra method as the [region memory audit](tree-regions-memory.md), with three medium-zoom traversals, three high-zoom traversals, and navigation to Ascendancies. All paired camera viewBoxes matched at every sample; no session recorded a page error or crash. Highest sampled whole-browser private footprints include renderer, GPU, browser and service processes and subtract that session's blank baseline. Highest samples include the navigation stages. They are retained-memory samples, not instantaneous peaks.

| Profile                 | Highest sampled increment before |     After | Difference | Maximum JS heap before → after |
| ----------------------- | -------------------------------: | --------: | ---------: | -----------------------------: |
| Phone 360×740, DPR 2    |                        342.5 MiB | 316.1 MiB |  −26.4 MiB |                51.7 → 52.4 MiB |
| Phone 390×844, DPR 3    |                        327.7 MiB | 291.5 MiB |  −36.3 MiB |                52.8 → 55.6 MiB |
| Desktop 1440×900, DPR 2 |                        391.5 MiB | 360.3 MiB |  −31.3 MiB |                55.2 → 54.6 MiB |

The observed direction is encouraging, but one pair per profile cannot establish a repeatable 26–36 MiB saving against Chrome's native allocation variability. The phone JS heap samples were slightly higher, despite fewer SVG elements and lower whole-browser samples; do not claim all memory categories decreased. Physical RAM was not constrained and Chrome's pressure-simulation command remained unavailable. No full test suite or physical low-RAM-device test was run.

## Validation

Nine targeted browser checks passed: desktop zoom/pan/inspection and dismissal, mobile taps, socketed jewel details, all five weapon palettes, Atlas and Ascendancy navigation/fullscreen, visibility-buffer coverage without duplicate targets, held inspection beyond the buffer, and batched paint coverage. The palette check now reads the actual visible fill paths. For the standalone tree with Unseen Paths enabled, summed fill/background/border disc counts match individual hit-target and artwork counts.

Ten targeted unit tests passed, including circle subpaths, paint-style selection, overlap ordering, region bounds, and intact crossing arcs. TypeScript and targeted lint passed.

A test-only render counter confirmed the earlier optimization still holds: a vertical pan retained 147 regions, added 47 and removed 59, with zero retained node/artwork region executions. Twenty subsequent hover transitions also caused zero region executions.

Two Build Bin screenshot pairs at 1406×758 pixels were compared in Chrome: overview dots and zoomed artwork. Mean absolute RGB-channel differences were 0.10 and 0.20 respectively (out of 255); 0.154% and 0.101% of pixels had any channel difference above 16. Screenshots were visually inspected. Circle versus path antialiasing is not pixel-identical, so these are visual-parity diagnostics rather than assertions of identical output.

Raw measurements: `tree-nodes-before.json`, `tree-nodes-after.json`, `tree-nodes-stress-before.json`, `tree-nodes-stress-after.json`, `tree-nodes-memory-before.json`, and `tree-nodes-memory-after.json`.
