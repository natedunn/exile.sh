import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { GemHeaderLevel } from "../../shared/gems"

export const getGemPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const [
      { gemCatalogue, gemHeaders, gemEffects, gemCompatibility },
      { gemBySlug, gemSlug },
      { compatibleGems },
    ] = await Promise.all([
      import("./assets.server"),
      import("../../shared/gem-slug"),
      import("../../shared/gem-compatibility"),
    ])
    const catalogue = await gemCatalogue()
    const reference = gemBySlug(catalogue, data.slug)
    if (!reference) return null
    const [headers, effects, compatibility] = await Promise.all([
      gemHeaders(),
      gemEffects(reference.skillId),
      gemCompatibility(),
    ])
    const levels: Partial<Record<string, GemHeaderLevel>> =
      headers.skills[reference.skillId] ?? {}
    return {
      reference,
      name: reference.name.replace(/:?\s*\{\d+\}/g, ""),
      slug: gemSlug(catalogue, reference),
      support: reference.support,
      description: reference.description.replace(/\s+/g, " ").trim(),
      header: Object.hasOwn(headers.gems, reference.gameId)
        ? headers.gems[reference.gameId]
        : undefined,
      levels,
      effects,
      compatible: compatibleGems(reference, catalogue, compatibility),
    }
  })
