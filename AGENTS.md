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
