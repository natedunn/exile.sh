import { useEffect, useState } from "react"

/* Starred currencies, kept in localStorage. `storageError` reports a
   browser that refuses to save, so the page can say favorites won't last. */
export function useWatchlist() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("exile.watchlist") ?? "[]"
      )
      if (Array.isArray(saved))
        setFavorites(
          saved.filter((value): value is string => typeof value === "string")
        )
    } catch {
      setStorageError(true)
    }
  }, [])

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem("exile.watchlist", JSON.stringify(next))
    } catch {
      setStorageError(true)
    }
  }

  return { favorites, toggleFavorite, storageError }
}
