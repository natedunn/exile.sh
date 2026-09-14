# SVG region memory comparison

Region grouping adds a measurable but much smaller memory cost than the retired Canvas experiment. The observed whole-browser overhead was tens of MiB; additional live JavaScript heap at matched stages never exceeded 3.5 MiB. Keeping the regions is a reasonable trade for the measured 38–44% reduction in panning JavaScript time, but this is not proof of suitability on physically low-RAM devices.

## Results

Two runs per variant and profile. All footprint values below subtract each browser's own blank baseline and include browser, renderer, GPU, and service processes. Ranges cover two paired runs, not confidence intervals. MiB means 1,048,576 bytes.

| Profile         | Ungrouped highest sampled increment | Regions highest sampled increment | Difference between paired highest samples | Largest positive matched-stage difference, per run |
| --------------- | ----------------------------------: | --------------------------------: | ----------------------------------------: | -------------------------------------------------: |
| 360×740, DPR 2  |                     298.3–303.0 MiB |                   307.6–312.6 MiB |                              +9.2–9.6 MiB |                                     +23.9–40.2 MiB |
| 390×844, DPR 3  |                     308.1–308.8 MiB |                   322.7–343.1 MiB |                            +13.9–35.0 MiB |                                     +39.2–41.7 MiB |
| 1440×900, DPR 2 |                     373.8–375.9 MiB |                   375.8–401.1 MiB |                         −0.1 to +27.3 MiB |                                     +19.2–27.3 MiB |

The highest-sample difference is not a ceiling on extra memory at every point: native allocations peak at different stages. The final column compares the same stage in each paired run after blank normalization. In particular, a nearly unchanged desktop peak in one pair does **not** imply zero cost. The largest positive matched-stage difference anywhere was 41.7 MiB on the DPR 3 phone profile.

Highest samples include all stages, including navigation away from the tree. Restricting the comparison to stages with the large tree mounted changes the second DPR 2 phone baseline from 303.0 to 299.4 MiB, and that pair's peak difference from 9.6 to 13.2 MiB; other paired peak results are unchanged. These are sampled retained footprints after garbage collection, not instantaneous peaks between samples.

| Profile       | Ungrouped maximum live JS heap | Regions maximum live JS heap | Largest positive matched-stage heap difference |
| ------------- | -----------------------------: | ---------------------------: | ---------------------------------------------: |
| Phone DPR 2   |                  49.7–51.9 MiB |                     51.8 MiB |                                        3.5 MiB |
| Phone DPR 3   |                       52.7 MiB |                     53.6 MiB |                                        3.5 MiB |
| Desktop DPR 2 |                  52.4–54.2 MiB |                     55.5 MiB |                                        3.5 MiB |

Native/browser allocations account for much of the difference beyond JavaScript heap. These counters cannot identify an exact GPU-versus-DOM cost attributable to regions.

## Repeated panning and cleanup

Across the first and third high-zoom traversals, region-run JS heap changed by −0.1 to +0.7 MiB; baseline changed by +0.2 to +0.5 MiB. Live SVG element counts at those repeated high-zoom endpoints stayed constant within each run. After navigating to Ascendancies, region-run heap was 43.6–43.8 MiB, versus baseline 43.4–43.6 MiB; each paired difference was under 0.25 MiB.

Whole-browser private memory did not return immediately to its earlier level: over the same high-zoom repetitions it changed by −3.7 to +42.6 MiB with regions and +21.1 to +49.1 MiB without them. That behavior occurs in both variants and is consistent with native allocation/cache retention, but this short audit cannot prove that all native growth is harmless or rule out longer-session leaks. The repeat data shows no clear additional runaway JavaScript retention from regions.

No successful session reported application errors or crashes. Chrome's memory-pressure simulation command was unavailable, so there was no successful RAM-pressure, OOM, or tab-discard test.

## Method

Chrome 153.0.8010.36 on the same macOS host and Vite development server used for the preceding audit. Phone viewport dimensions and device-pixel ratios were simulated; physical RAM was not constrained. Twelve completed isolated browser sessions: three profiles × two variants × two runs. Run 0 used ungrouped then regions; run 1 reversed the order. Each session used a new browser process and its own blank baseline.

The control is a **test-only ungrouped variant of the current renderer**, not a checkout of an older commit. Playwright intercepts the served passive-tree module to use one node/artwork group and the earlier per-node visibility predicate. Both variants retain the hover isolation, connection batching, camera behavior, assets, and current components. Both use module interception to match routing/cache behavior. The script checks that exactly one module was intercepted and that the control has one region while the current renderer has multiple. All twelve runs received the same original module SHA-256. Camera viewBox values matched at every paired sample, including the navigation endpoint. No application source was modified for this comparison.

Samples: blank, overview, 3.375× artwork, three wide-pan traversals, 7.59375× artwork, three further traversals, navigation to Ascendancies, and settled navigation. Medium traversals use six long drags in each of four directions; high zoom uses twelve. The existing memory harness forces GC and reads Chrome memory-infra private footprints, Runtime heap usage, and DOM counters. Live SVG counts and camera bounds were added for comparison validation. Browser tracing can fluctuate and includes instrumentation/development overhead; these absolute values should not be presented as production RAM requirements.

One attempt at the last desktop baseline session failed because Chrome returned an unsuccessful memory dump at overview. Its partial measurements were discarded; that one session was rerun successfully. It was a measurement failure, not an observed application crash. The raw file contains only the twelve complete sessions. No full application test suite was rerun.

Reproduce against the running Vite server:

```sh
TREE_MEMORY_COMPARE_REGIONS=1 TREE_MEMORY_RUNS=2 node scripts/measure-tree-memory.mjs /tmp/tree-regions-memory.json
```

The test-only source transformation intentionally fails if the expected renderer expressions change. `TREE_MEMORY_PROFILE`, `TREE_MEMORY_START_RUN`, and `TREE_MEMORY_VARIANT` can isolate an interrupted session; write retries to a separate output file to preserve completed results.

Raw measurements: [tree-regions-memory-results.json](tree-regions-memory-results.json). Related [panning results](tree-panning.md#stable-svg-regions) and [historical Canvas memory audit](tree-memory.md).
