import catalog from "../../shared/catalog.json"
import type { CatalogItem } from "../../shared/economy"

export const items = new Map<string, CatalogItem>(catalog.map((i) => [i.id, i]))
export function itemInfo(id: string): CatalogItem {
  return (
    items.get(id) ?? {
      id,
      name: id.split("/").at(-1) ?? id,
      category: "Other",
      icon: "",
      description: "Community metadata is not available for this item yet.",
    }
  )
}
export const CATEGORIES = [
  "All currencies",
  "Currency",
  "Fragments",
  "Runes",
  "Essences",
  "Soul Cores",
  "Omens",
  "Uncut Gems",
  "Lineage Gems",
  "Breach",
  "Delirium",
  "Expedition",
  "Abyss",
  "Idols",
  "Keys",
  "Incursion",
  "Verisium",
  "Other",
]
