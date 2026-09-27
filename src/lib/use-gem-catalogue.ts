import { useQuery } from "@tanstack/react-query"
import type { GemCatalogue, GemHeaders } from "../../shared/gems"

export function useGemCatalogue(enabled = true) {
  return useQuery<GemCatalogue>({
    queryKey: ["gem-reference", "v1", "headers-v1"],
    enabled,
    queryFn: async () => {
      const [catalogueResponse, headersResponse] = await Promise.all([
        fetch("/gems/v1/catalogue.json"),
        fetch("/gems/v1/headers.json"),
      ])
      if (!catalogueResponse.ok || !headersResponse.ok)
        throw new Error("Gem reference unavailable")
      const [catalogue, headers] = await Promise.all([
        catalogueResponse.json() as Promise<GemCatalogue>,
        headersResponse.json() as Promise<GemHeaders>,
      ])
      return { ...catalogue, headers }
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
