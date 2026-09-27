import { useQuery } from "@tanstack/react-query"
import type { GemSearchIndex } from "./gem-search"

export function useGemSearchIndex() {
  return useQuery<GemSearchIndex>({
    queryKey: ["gem-search-index", "v1"],
    queryFn: async () => {
      const response = await fetch("/gems/v1/search-index.json")
      if (!response.ok) throw new Error("Gem search index unavailable")
      return response.json()
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
