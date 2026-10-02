import { createServerFn } from "@tanstack/react-start"
import { itemBySlug } from "../../shared/item-registry"
import { z } from "zod"

export const getItemMeta = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().max(200) }))
  .handler(async ({ data }) => {
    const { itemCatalogue } = await import("./assets.server")
    const item = itemBySlug(await itemCatalogue(), data.slug)
    if (!item) return null
    return {
      name: item.name,
      slug: item.slug,
      image: item.image,
      description:
        item.kind === "unique"
          ? `${item.name}, a unique ${item.baseName} in Path of Exile 2. Explore its modifiers, variants and roll ranges.`
          : `${item.name}, a ${item.itemClass} base in Path of Exile 2. Explore base stats, implicit modifiers and modifier references.`,
    }
  })
