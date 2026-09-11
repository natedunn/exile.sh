# Unique jewel rendering audit

Audited the 13 unique names (15 base variants including Grand Spectrum) in our PoE2 catalogue against PoB commit ce566eac45ea8a86477f513c7ee65a1ebe60014e:

- [Hand-authored jewels](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/ce566eac45ea8a86477f513c7ee65a1ebe60014e/src/Data/Uniques/jewel.lua)
- [Generated jewels](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/ce566eac45ea8a86477f513c7ee65a1ebe60014e/src/Data/Uniques/Special/Generated.lua)
- [Radius definitions](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/ce566eac45ea8a86477f513c7ee65a1ebe60014e/src/Modules/Data.lua)
- [Distance multiplier](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/blob/ce566eac45ea8a86477f513c7ee65a1ebe60014e/src/Data/Misc.lua)

The viewer renders the saved build, not a new calculation. Every socketed jewel has item details, including rare/magic jewels. Tree specs retain independent socket assignments; older immutable snapshots recover assignments from their original code. Selected variants are resolved before detecting radius effects. Only allocated sockets contribute radius overlays.

| Jewel                                  | Rendering support                                                                                  | Calculation limits                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| From Nothing                           | Small radius centered on the named keystone, including multiline exports and selected PoB variants | Saved allocated nodes are shown; no build editing        |
| Controlled Metamorphosis               | All eight annuli, with inner holes; affected-node membership excludes the hole                     | No allocation editing                                    |
| Against the Darkness                   | Socket-centered radius; small/notable radius grants listed per covered node in the inspector       | Grants are shown as extra lines, not summed into totals  |
| Heroic Tragedy                         | Very Large radius, exported seed/leader, conquered-node warning                                    | Seeded transformations are not calculated                |
| Undying Hate                           | Very Large radius, exported seed/leader, conquered-node warning                                    | Seeded transformations are not calculated                |
| Megalomaniac                           | Exported grants and markers at resolved notable nodes                                              | No recalculation                                         |
| Flesh Crucible                         | Exported modifiers and markers for resolved named keystones                                        | Conditional effects are not recalculated                 |
| Grand Spectrum (Ruby/Emerald/Sapphire) | Individual socket entries, base-specific artwork, and exported modifier text                       | Cross-jewel totals are not recomputed                    |
| The Adorned                            | Exported multiplier and conditions                                                                 | Corrupted magic jewel effects are not recomputed         |
| Prism of Belief                        | Selected skill modifier                                                                            | Skill levels are not recomputed                          |
| Heart of the Well                      | Exported modifier text                                                                             | Effects are not recalculated                             |
| Split Personality                      | Starting-point modifier and saved allocation                                                       | Starting-point eligibility is not recomputed             |
| Voices                                 | Exported socket grants and saved mapped nodes                                                      | Unmapped generated sockets remain a disclosed limitation |

Rare Time-Lost jewels use the same "Small/Notable Passive Skills in Radius also grant" wording and get the same per-node listing; keystones inside a radius gain nothing.

Do not describe this as full unique-jewel calculation support. Timeless seed transformations, global multipliers, generated sockets, and dynamic node-stat rewriting remain separate work. Existing PoB summary statistics represent the author's exported calculation and are unchanged.

PoB's supported 0.1–0.5 versions use the 0.1 radius table and a distance multiplier of 1.2. Keep subsequent radius tables versioned. Unknown radius labels/keystones are explicitly disclosed rather than drawn at a guessed location.
