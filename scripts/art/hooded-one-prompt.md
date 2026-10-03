# Hooded One hero artwork

Created with the built-in image generation tool from the user-provided Hooded One cutout. The highlighted edit is retained as `scripts/art/hooded-one-highlighted-source.webp`. The homepage asset is rendered through the existing bronze palette, 8×8 Bayer dither, and masthead dissolve in `scripts/dither-art.mjs`, at 160 × 144 native pixels. Final asset: `public/art/hooded-one-masthead.png`.

Regenerate only this artwork with `node scripts/dither-art.mjs --hooded-one`.

## Edit prompt

Edit the supplied character cutout for a dark website hero. Preserve this exact Hooded One character, pose, hood shape, torn fabric, shoulders, crop and mysterious empty face. Do not redesign him or invent extra anatomy. Transparent background. Transform the existing art to a crisp ordered-dither / stippled pixel illustration with a restrained warm antique gold / bronze palette, suitable on a near-black background. Lift the cloak midtones substantially so hood outline, folds and shoulders remain legible at small display size. Keep face nearly black, but make the two small glowing eyes clearly visible, pale gold with a subtle icy blue core. No scene, no text, no frame, no solid black background. Preserve the silhouette and subject recognizable from the source, with isolated transparent pixels creating the dither texture. Single character cutout, same composition.
