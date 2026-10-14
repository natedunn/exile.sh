import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import type { GemHeaderLevel } from "../../shared/gems"

export const getGemPage = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z.string().max(120),
      releaseId: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{2,79}$/)
        .default("legacy"),
    })
  )
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
    const catalogue = await gemCatalogue(data.releaseId)
    const reference = gemBySlug(catalogue, data.slug)
    if (!reference) return null
    const [headers, effects, compatibility] = await Promise.all([
      gemHeaders(data.releaseId),
      gemEffects(reference.skillId, data.releaseId),
      gemCompatibility(data.releaseId),
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
