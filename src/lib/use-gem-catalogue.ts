import { fetchDataAsset, dataReleaseKey } from "../../shared/data-assets"
import { useQuery } from "@tanstack/react-query"
import type { GemCatalogue, GemHeaders } from "../../shared/gems"

export function useGemCatalogue(enabled = true) {
  return useQuery<GemCatalogue>({
    queryKey: [dataReleaseKey, "gem-reference", "v1", "headers-v1"],
    enabled,
    queryFn: async () => {
      const [catalogueResponse, headersResponse] = await Promise.all([
        fetchDataAsset("/gems/v1/catalogue.json"),
        fetchDataAsset("/gems/v1/headers.json"),
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
