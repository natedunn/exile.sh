/** Share titles and descriptions for the tree pages, used by each page's
 * meta tags and its card at /og/trees/$tree. The card's label already names
 * the game, so its `body` leaves it out. */
export const treeShares = {
  passive: {
    title: "Passive Tree",
    path: "/trees/passive",
    description:
      "Search and inspect every Path of Exile 2 passive skill, with ascendancy overlays and tree versions 0.1 to 0.5.",
    body: "Search every passive skill, with ascendancy overlays and tree versions 0.1 to 0.5.",
  },
  ascendancies: {
    title: "Ascendancy Trees",
    path: "/trees/ascendancies",
    description:
      "Every Path of Exile 2 ascendancy's passives for each tree version, including alternate trees such as the Abyssal Lich.",
    body: "Every ascendancy's passives for each tree version, including alternate trees such as the Abyssal Lich.",
  },
  atlas: {
    title: "Atlas Trees",
    path: "/trees/atlas",
    description:
      "The Path of Exile 2 Atlas passive tree and its mechanic subtrees, with the options of every choice node.",
    body: "The Atlas passive tree and its mechanic subtrees, with every choice node's options.",
  },
  genesis: {
    title: "The Genesis Tree",
    path: "/trees/genesis",
    description:
      "Breach's Genesis Tree from the Monastery of the Keepers: every Womb's passives and the options of each choice notable.",
    body: "Breach's Genesis Tree from the Monastery of the Keepers: every Womb's passives and the options of each choice notable.",
  },
} as const

export type TreeShare = keyof typeof treeShares

export const isTreeShare = (value: string): value is TreeShare =>
  Object.hasOwn(treeShares, value)
