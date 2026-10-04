import { useQuery } from "@tanstack/react-query"
import type {
  ItemCatalogue,
  ModifierCatalogue,
} from "../../shared/item-registry"

async function readReference<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error("Item reference unavailable")
  return response.json() as Promise<T>
}

export function useItemRegistry(enabled = true) {
  return useQuery({
    queryKey: ["item-registry", "v1"],
    enabled,
    queryFn: () => readReference<ItemCatalogue>("/items/v1/catalogue.json"),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}

export function useItemModifiers(enabled: boolean) {
  return useQuery({
    queryKey: ["item-modifiers", "v1"],
    queryFn: () => readReference<ModifierCatalogue>("/items/v1/modifiers.json"),
    enabled,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })
}
