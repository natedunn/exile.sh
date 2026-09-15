<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/functions/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## UI components

Use the project's shadcn/ui `base-nova` components from `src/components/ui`
for applicable controls. Interactive primitives must use `@base-ui/react`;
do not add the Radix variants or duplicate native controls in route files.
Add components with the existing `components.json` configuration, then adapt
shared styles to the workbench tokens in `tokens.css`. Keep custom economy
charts, data calculations, and layout where a generic control is not a fit.
Verify keyboard behavior and mobile widths when replacing interactive controls.

Field focus styling belongs in `src/components/ui/field.css`, consumed by the
shared Input, Textarea, SelectTrigger, and InputGroup components. Use InputGroup
with InputGroupInput/Addon/Button for fields containing icons or actions; do not
add route-specific focus outlines or rings to the inner control.

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
