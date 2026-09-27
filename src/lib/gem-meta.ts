import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

/** What a gem page's share tags need, resolved on the server so crawlers
 * see it in the first HTML response. Null when the slug matches no gem. */
export const getGemMeta = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const [{ gemCatalogue }, { gemBySlug, gemSlug }] = await Promise.all([
      import("./assets.server"),
      import("../../shared/gem-slug"),
    ])
    const catalogue = await gemCatalogue()
    const gem = gemBySlug(catalogue, data.slug)
    if (!gem) return null
    return {
      name: gem.name.replace(/:?\s*\{\d+\}/g, ""),
      slug: gemSlug(catalogue, gem),
      support: gem.support,
      description: gem.description.replace(/\s+/g, " ").trim(),
    }
  })
