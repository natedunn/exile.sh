# Tree viewer controls

The passive explorer places its controls in the shared renderer's top-left panel;
zoom stays bottom-right. The Atlas has neither a version row nor a passive panel.

`TreeExplorer` accepts these optional props:

- `showPanel`: hide the whole panel (default true).
- `showVersionSelector`: hide the version control (default true).
- `showAscendancySelector`: hide the ascendancy control (default true).
- `defaultAscendancy`: lock an ascendancy and hide its selector. `"None"` locks the empty center.
- `showPaletteSelector`: hide the palette picker (default true); it also requires allocated nodes.
- `allocatedNodes`: allocated IDs for inspection and palette display (default empty).

If the panel or ascendancy selector is disabled without an explicit
`defaultAscendancy`, no center ascendancy is loaded. Otherwise only the chosen
snapshot and its icon manifest are requested. The camera bounds use the main tree
and do not change when the center content or Oracle paths change.

The existing controlled version/section callbacks keep URL state in the page.
Version defaults to 0.5 through the route. TreePage stores selections under
`exile.tree.ascendancy`; an explicit URL section takes precedence. Both tree pages
use the same preference. Choosing None stores `"None"`, distinct from having no
saved preference. Unsupported ascendancies show None on the passive page and the
first available ascendancy on the ascendancy page without discarding the preference.

Only Oracle exposes Paths Not Taken, and other ascendancies never render those
paths even if the URL retains `unseen=true`. Palette settings use the existing
`exile.tree.palette` preference. Build Bin's `PassiveTree` hides its picker by
default; `showPaletteSelector` can enable it inside the shared panel. Existing
saved palettes still apply to builds, including previews and weapon-set legends.
