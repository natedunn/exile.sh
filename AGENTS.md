<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/functions/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## UI components and styling

Styling is Tailwind utilities plus the shared components in
`src/components/ui`. The design tokens in `tokens.css` are the only
vocabulary: every colour, type size, radius, shadow, tracking and easing is a
`@theme` entry there, and Tailwind's default palette, type scale and radii are
cleared. Reach for `bg-surface`, `text-ink-muted`, `text-label`,
`border-rule-strong`, `shadow-popup`, `duration-120`. Do not write an
arbitrary colour or size; add a token first if one is genuinely missing.
Spacing uses Tailwind's numeric scale (`p-3` is 12px). Composed voices live
as `@utility` rules in `src/styles.css`: `mono-label`, `figure`,
`display`, `dot-screen`, `dither-fade`, `popup-corners`,
`touch-safe-text`.

Element resets in `src/styles.css` sit in `@layer base` so utilities always
win over them. Page-level CSS files and semantic class names are not allowed.
The only hand-written rules in `styles.css` are base resets and `@utility`
definitions for textures or renderer effects that utilities cannot express.
Run `bun run lint` after styling changes; its classname check rejects tokens
that Tailwind does not compile.

Use the shared components for anything repeated: `Button` (variants include
`pill` and `segment`, sizes include `nav` and `bare`), `SegmentedControl`,
`Panel`, `EmptyState`, `Label`/`LabelText`, `Field`, `Badge`/`StatusDot`,
`Note`, `PageHeading`/`PageTitle`/`PageMeta`, and `PopoverContent
variant="inspection"` for item, gem and passive tooltips. Interactive
primitives must use `@base-ui/react`; do not add Radix variants or duplicate
native controls in route files. Components own their focus treatment: fields
use a `focus-glow` ring, everything else the 2px `focus` outline. Do not
style a ui component from page CSS through `[data-slot]` selectors; add a
variant or pass `className`. Verify keyboard behaviour and mobile widths when
replacing interactive controls.

Do not add decorative eyebrows or kickers above headings anywhere in the site.
Use direct headings; retain functional field and metric labels.

## Tree search performance

Keep search input state outside the SVG renderer. Match against a cached index in
its worker, reject outdated replies, and retain the yielding fallback. Keep result
rows virtualized and glow geometry batched; broad queries can match thousands of
nodes. Preserve keyboard access to offscreen results. When changing this feature,
run the tree-search browser tests and compare `scripts/measure-tree-search.mjs`
against the same build and browser conditions; avoid debounce delays that mask
main-thread work.

## Preserve running development servers

Treat an existing development server as user-owned. Reuse it for browser checks
with `PLAYWRIGHT_BASE_URL`; do not restart it, take over its Portless route with
`--force`, or use broad process-kill commands. Only stop a process started for the
current task when its ownership is known. If a separate test server is necessary,
use an unused port and a distinct route without replacing an existing server.

Avoid production builds in the same working directory while a development server
is running: generated files and caches may be shared. Use an isolated checkout for
build validation, or report that the build was deferred. Prefer targeted tests,
type checks, and browser checks against the running server during UI work.
