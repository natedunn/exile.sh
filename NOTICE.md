# Third-party data and artwork

Original exile.sh code is MIT-licensed. That license does not grant rights to Grinding Gear Games’ intellectual property.

- Exchange prices: Grinding Gear Games’ documented [Currency Exchange API](https://www.pathofexile.com/developer/docs/reference#currency-exchange).
- Item metadata: [RePoE fork](https://github.com/repoe-fork/repoe-fork), [PoE2 export](https://repoe-fork.github.io/poe2/base_items.min.json). `shared/catalog-source.json` records retrieval and SHA-256 provenance. `python3 scripts/update-catalog.py` refreshes the snapshot; review its diff and categories before committing.
- Game names, descriptions, and artwork belong to Grinding Gear Games. Item images are served from the community export’s artwork paths. Missing images receive a fallback icon. RePoE’s tooling license does not relicense game assets.
- Geist fonts are distributed through Fontsource under the SIL Open Font License. Dependency license files remain in their packages.
- Fontin is a font by Jos Buivenga ([exljbris](https://www.exljbris.com)), embedded under the [exljbris free font licence](https://www.exljbris.com/eula.html). It is not covered by this project’s MIT license and may not be redistributed separately.
- The exile.sh mark and interface are original project assets.

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
