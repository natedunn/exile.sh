# Passive-tree zooming

Panning had already been batched, culled and memoized (see [panning](tree-panning.md)); wheel and pinch zoom had not. Every wheel event committed React state, and every commit re-rendered every visible node region and artwork region, because both received a stroke scale derived from the live zoom.

## Changes

- **Batched zoom.** Wheel and pinch input update the camera ref and write the SVG `viewBox` once per animation frame, like panning. React commits only when the view outgrows the rendered buffer, crosses a rendering threshold (culling above 1×, artwork at the artwork zoom), or 150 ms after the gesture settles. The zoom label and the jewel-radius halftone pattern are written directly between commits so they stay current.
- **Zoom-independent region props.** Node and artwork regions only use the stroke scale to keep non-scaling strokes out of their overlap checks. They now receive the scale at the widest view each layer is drawn at (1× for nodes, the artwork zoom for artwork). That upper bound stays conservative at every zoom and changes only on resize, so zooming never re-renders a region.
- **Progressive artwork.** Crossing the artwork zoom used to mount every visible artwork region, about 2,300 images, in one commit. `ArtworkLayer` now mounts the regions nearest the camera first, four per frame. Progress re-renders only that layer; mounted regions stay memoized.
- **No backdrop blur behind fullscreen dialogs.** The Build Bin tree opens in a fullscreen dialog whose overlay blurred the page underneath. The dialog is opaque, so the blur was invisible, but it was recomputed as the tree repainted.

## Results

`scripts/measure-tree-pan.mjs` with `TREE_PERF_GESTURE=zoom`: 120 wheel steps of 14 px at the viewport centre, 60 in and 60 out, 8 ms apart, similar to a trackpad. Chrome through Playwright against the Vite development server, 1440 × 900. Normal is DPR 1 with no throttling; stress is DPR 2 with 4× CPU throttling. Each row is the median of three runs. Before is `HEAD` at the time (e329faa); both used the same script and machine. The Build Bin rows use `shared/fixtures/pob/2k0EPn6QOhTx.txt`.

| Tree, profile, starting zoom | React commits | Frames over 25 ms | p95 frame (ms) | p99 frame (ms) | Worst frame (ms) | FunctionCall (ms) |
| ---------------------------- | ------------: | ----------------: | -------------: | -------------: | ---------------: | ----------------: |
| Passive, normal, 1×          |      120 → 66 |            30 → 1 |    33.4 → 16.8 |   116.6 → 16.8 |     133.4 → 33.4 |       5,766 → 505 |
| Passive, normal, 2.25×       |      120 → 61 |            21 → 1 |    33.3 → 16.8 |    83.3 → 16.8 |       100 → 33.4 |       3,791 → 409 |
| Passive, stress, 1×          |       120 → 4 |           139 → 7 |   466.7 → 16.8 |   533.3 → 50.1 |     566.7 → 66.7 |      27,927 → 361 |
| Passive, stress, 2.25×       |      112 → 48 |          147 → 37 |       350 → 50 |   533.2 → 66.7 |      550 → 166.6 |    25,478 → 1,675 |
| Build Bin, normal, 1×        |      120 → 67 |            27 → 1 |    33.3 → 16.8 |   116.7 → 16.8 |     133.4 → 33.4 |       5,670 → 542 |
| Build Bin, normal, 2.25×     |      120 → 62 |            20 → 1 |    33.3 → 16.7 |    83.3 → 16.8 |       100 → 33.3 |       3,770 → 424 |
| Build Bin, stress, 1×        |       120 → 4 |           137 → 7 |     500 → 16.8 |   549.9 → 66.7 |        700 → 100 |      30,575 → 449 |
| Build Bin, stress, 2.25×     |      114 → 50 |          135 → 36 |     450 → 33.5 |   633.2 → 66.8 |    733.3 → 183.4 |    29,407 → 1,624 |

Most remaining commits are the small progressive-artwork steps (2–5 ms each in development). They appear when the gesture crosses the artwork zoom: the normal runs reach it from either start, and the throttled runs mostly only from 2.25×. Paint time was largely unchanged; the gain is in JavaScript and frame pacing. The stress 2.25× rows are the slowest remaining case: artwork still mounts at roughly 30–50 ms per frame under 4× throttling.

This harness showed little Build Bin penalty before the change, unlike an earlier `chromium-headless-shell` run where the Build Bin tree had about 150 frames over 25 ms against 23 on the Passive page, most of it from the hidden backdrop blur. Blur cost depends on the compositor and GPU, so the dialog change should be judged on real hardware rather than from this table.

These are development-server measurements. Production React is faster, so absolute times will be lower, but the commit counts and the proportions should hold.

### Panning check

The same script's default pan gesture at 3.375× on the Passive page, median of three runs, before → after: frames over 25 ms 1 → 1, p95 16.7 → 16.8 ms, worst 49.9 → 33.3 ms. React commits rose from 2 to 28 and FunctionCall from 134 to 229 ms. Regions entering the buffer now mount their artwork over a few frames instead of all at once in the buffer-exit commit.

Raw runs: [before](results/tree-zoom-before.json), [after](results/tree-zoom-after.json).

Reproduce with a running local server:

```sh
TREE_PERF_GESTURE=zoom TREE_PERF_ZOOM_CLICKS=0,2 PLAYWRIGHT_BASE_URL=http://localhost:4873/trees/passive node scripts/measure-tree-pan.mjs /tmp/tree-zoom.json
TREE_PERF_GESTURE=zoom TREE_PERF_ZOOM_CLICKS=0,2 PLAYWRIGHT_BASE_URL=http://localhost:4873/build-bin TREE_PERF_BUILD=shared/fixtures/pob/2k0EPn6QOhTx.txt node scripts/measure-tree-pan.mjs /tmp/tree-zoom-build.json
```

Add `TREE_PERF_DPR=2 TREE_PERF_CPU=4` for the stress profile.

## Verification

The tree, pinch, search, pins, Atlas, Build Bin and Build Bin visual-parity e2e specs pass (74 tests). Scripted checks confirmed that the zoom label updates during a gesture and settles on the committed value. The halftone cell also stays at 6 screen pixels throughout.
