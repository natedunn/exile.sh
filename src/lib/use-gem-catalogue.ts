import { useQuery } from "@tanstack/react-query"
import type { GemCatalogue } from "../../shared/gems"

export function useGemCatalogue(enabled = true) {
  return useQuery<GemCatalogue>({
    queryKey: ["gem-reference", "v1"],
    enabled,
    queryFn: async () => {
      const response = await fetch("/gems/v1/catalogue.json")
      if (!response.ok) throw new Error("Gem reference unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
