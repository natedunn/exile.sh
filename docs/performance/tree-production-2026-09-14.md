# Production tree panning — September 14, 2026

Measured https://exile.sh/trees/passive using `scripts/measure-tree-pan.mjs`, Chrome, a 1440×900 viewport, three runs per zoom, and the existing 120-move pan gesture (280 px horizontal amplitude). Images were loaded before measurement. These are requestAnimationFrame intervals with CDP tracing enabled, not field telemetry or a physical phone test.

| Profile                        | Zoom   | p95 interval | p99 interval | Worst interval | Intervals >25 ms, each run |
| ------------------------------ | ------ | ------------ | ------------ | -------------- | -------------------------- |
| Desktop, DPR 1, no throttling  | 3.375× | 16.7–16.8 ms | 16.7–16.8 ms | 16.8 ms        | 0 / 0 / 0                  |
| Desktop, DPR 1, no throttling  | 7.594× | 16.7 ms      | 16.8 ms      | 16.8 ms        | 0 / 0 / 0                  |
| Stress, DPR 3, 4× CPU slowdown | 3.375× | 16.7–16.8 ms | 16.8–83.3 ms | 183.3 ms       | 2 / 2 / 3                  |
| Stress, DPR 3, 4× CPU slowdown | 7.594× | 16.8 ms      | 16.8 ms      | 16.8 ms        | 0 / 0 / 0                  |

Desktop intervals stayed near 60 Hz. The stress profile exposed occasional medium-zoom hitches, while closer zoom stayed smooth. Throttling does not simulate a phone GPU or low RAM, and the stress profile retains desktop viewport dimensions. This measures warmed panning, not initial loading, pinch performance, or Core Web Vitals. Prior development benchmarks are not a controlled before/after comparison with this production build.

Raw runs: [desktop](results/tree-production-desktop-2026-09-14.json), [stress](results/tree-production-constrained-2026-09-14.json).

Reproduce with `PLAYWRIGHT_BASE_URL=https://exile.sh/trees/passive TREE_PERF_RUNS=3 node scripts/measure-tree-pan.mjs /tmp/tree-production-desktop.json`. Add `TREE_PERF_DPR=3 TREE_PERF_CPU=4` for the stress profile.
