/** Share cards for pages without art of their own, served at
 * /og/pages/$page. Each draws the homepage's art for its feature, and
 * `path` is the page it stands for; `default` is the fallback for every
 * page that sets no image. The card's label already names the game, so its
 * `body` leaves it out. */
export const pageShares = {
  default: {
    path: "/",
    art: "default",
    title: "exile.sh",
    body: "A collection of tools for Path of Exile 2.",
  },
  market: {
    path: "/economy/market",
    art: "economy",
    title: "Currency Market",
    body: "Currency prices, exchange rates and traded volume by league, from completed exchange trades.",
  },
  movers: {
    path: "/economy/movers",
    art: "economy",
    title: "Market Movers",
    body: "The currencies rising and falling fastest in each league, from completed exchange trades.",
  },
  methodology: {
    path: "/methodology",
    art: "economy",
    title: "Methodology",
    body: "How exile.sh prices currency from GGG exchange data, and where those prices fall short.",
  },
  items: {
    path: "/items",
    art: "items",
    title: "Items",
    body: "Every unique and base: unique rolls, implicit modifiers and base modifier references.",
  },
  "build-bin": {
    path: "/build-bin",
    art: "build-bin",
    title: "Build Bin",
    body: "Turn a Path of Building 2 export into a readable, shareable build: equipment, skills, passives and stats.",
  },
  "patch-notes": {
    path: "/patch-notes",
    art: "patch-notes",
    title: "Patch Notes",
    body: "Official patch notes and hotfixes, formatted for easy reading.",
  },
} as const

export type PageShare = keyof typeof pageShares

export const isPageShare = (value: string): value is PageShare =>
  Object.hasOwn(pageShares, value)

export const pageShareImage = (page: PageShare) => `/og/pages/${page}`
