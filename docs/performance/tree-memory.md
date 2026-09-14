# Tree renderer memory comparison

> Historical SVG/Canvas comparison. The Canvas experiment has since been removed; the memory harness now measures SVG only. Raw comparison results are preserved.

The current Canvas prototype has a meaningful memory cost compared with SVG. Keep it opt-in while reducing allocation churn and the retained raster budget; these measurements do not establish low-RAM device safety. No application or renderer code changed for this audit, and the full test suite was not rerun.

## Method

Tested Chrome 153.0.8010.36 on a macOS host with 16 GiB RAM, against the same Vite development server. Screen sizes and device-pixel ratios were emulated; physical RAM was not constrained. Each renderer/profile combination ran twice in a fresh isolated browser, with order reversed on the second run: 12 browser sessions total.

Each session sampled a blank browser, tree overview, 3.375× artwork, three repeated wide-pan traversals, 7.59375× artwork, three more traversals, and two samples after SPA navigation to Ascendancies unmounted the large viewer. Medium traversals used six long drags in each of four directions; high-zoom traversals used twelve per direction. Native pointer input exercised the existing camera constraints.

Chrome memory-infra dumps supplied `process_totals.private_footprint_bytes`, summed once per process across the isolated browser (including renderer, GPU, browser and services). Values are hexadecimal in the protocol. Each run was normalized against its own blank-browser baseline. This is a whole-browser private-footprint increment, not an exact per-origin memory measurement. Instrumentation and browser allocation pools contribute to it.

JavaScript heap/DOM counters were collected separately. Weak references tracked off-DOM tile and sprite canvases without retaining them, estimating backing storage as width × height × 4 bytes. These pixel estimates are not physical-RAM measurements and must not be added to process footprints. SVG also has native raster/image memory even though this observer sees no HTML canvas surfaces for it. Chrome documents the distinction between [OS footprint and live JavaScript memory](https://developer.chrome.com/docs/devtools/memory-problems).

Samples were taken after explicit garbage collection and deterministic memory dumps. They describe sampled retained footprints, not instantaneous allocation peaks; transient memory between samples can be higher. The attempted memory-pressure simulation was unavailable in this Chrome build on both browser/page debugging targets. No OOM, tab-discard, or genuinely low-RAM hardware test was performed.

## Highest sampled footprint

Highest active-viewer sample minus blank-browser baseline, in MiB (1,048,576 bytes). Ranges cover the two runs. The difference column compares the matched runs; it is not a confidence interval.

| Screen profile    | SVG increment | Canvas increment | Canvas extra vs SVG |
| ----------------- | ------------: | ---------------: | ------------------: |
| 360 × 740, DPR 2  |       350–368 |          509–530 |            +141–180 |
| 390 × 844, DPR 3  |       310–411 |          573–654 |            +161–344 |
| 1440 × 900, DPR 2 |       368–419 |          660–702 |            +283–292 |

Canvas had a higher sampled high-water footprint in all six matched comparisons. Artwork startup was particularly expensive in several runs, even before tile caches filled. Browser-native/GPU memory is materially larger than the raw retained canvas-pixel estimate. These desktop development measurements should not be presented as predicted RAM use on an Android or iOS device; browser cache policies and memory management can differ.

## Retained Canvas backing data

| Screen profile    | Maximum retained tiles | Tile pixels (MiB) | All tracked canvas pixels (MiB) | After unmount (MiB) |
| ----------------- | ---------------------: | ----------------: | ------------------------------: | ------------------: |
| 360 × 740, DPR 2  |                     22 |                88 |                            92.5 |                   0 |
| 390 × 844, DPR 3  |                     13 |               117 |                           129.2 |                   0 |
| 1440 × 900, DPR 2 |                     30 |               120 |                           139.6 |                   0 |

The 32-million-pixel tile limit is approximately 122 MiB (128 decimal MB). Whole-tile rounding gives 120 MiB at DPR 2 and 117 MiB at DPR 3 when full. The smaller DPR-2 traversal retained 22 tiles rather than reaching its 30-tile limit; the DPR-3 phone profile and desktop profile reached their limits. The limit currently does not scale down for small screens.

The explicit tile/sprite storage stabilized in repeated traversals, but native/GPU process footprints still fluctuated and sometimes rose despite stable tile counts. A bounded JavaScript cache is not a total-memory cap. All tracked canvas objects/backing data were gone after unmount in every Canvas run. The surrounding application, query caches and browser-native pools remain; this is not a claim that total memory returns to the blank-browser baseline or a proof against every possible leak.

## JavaScript alone would miss the tradeoff

| Screen profile    | SVG live heap range (MiB) | Canvas live heap range (MiB) |
| ----------------- | ------------------------: | ---------------------------: |
| 360 × 740, DPR 2  |                     43–50 |                        44–46 |
| 390 × 844, DPR 3  |                     43–50 |                        44–46 |
| 1440 × 900, DPR 2 |                     44–54 |                        46–49 |

No page crashes or uncaught page errors occurred on this host. That does not demonstrate safety on a device with less available RAM.

## Next changes to evaluate

1. Reuse tile backing surfaces as icons load and tiles are evicted, instead of repeatedly creating replacement canvases. The current image-load invalidation path deletes affected tiles and `prepare` allocates new surfaces; this is a candidate source of native/GPU allocation churn, not a proven explanation for every footprint increase.
2. Use a conservative viewport-based raster budget, with smaller tiles where necessary to fit a high-density phone viewport within that budget. Keep SVG available when the budget cannot support Canvas; do not rely solely on a device-RAM API or assume a small screen means plentiful memory.
3. Repeat this targeted memory comparison after those changes, then validate on actual low-RAM hardware and a production build before making Canvas the default.

## Reproduce

```sh
TREE_MEMORY_RUNS=2 node scripts/measure-tree-memory.mjs /tmp/tree-memory-results.json
```

`PLAYWRIGHT_BASE_URL` supplies the server URL (default `http://127.0.0.1:4173`). `TREE_MEMORY_PROFILE` optionally selects `mobile-2x`, `mobile-3x`, or `desktop-2x`. No application instrumentation is required. Raw samples, process breakdowns, heap/DOM counters, canvas estimates, errors and unsupported-pressure details are saved in [tree-memory-results.json](tree-memory-results.json).
