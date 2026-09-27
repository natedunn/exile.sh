import { queryOptions } from "@tanstack/react-query"
import type { GemEffects } from "../../shared/gems"

export function gemEffectsQueryOptions(skillId: string) {
  return queryOptions<GemEffects>({
    queryKey: ["gem-effects", "v1", skillId],
    queryFn: async () => {
      const response = await fetch(
        `/gems/effects-v1/${encodeURIComponent(skillId)}.json`
      )
      if (!response.ok) throw new Error("Gem effects unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  })
}
