import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useCRPC } from "./convex/crpc"
import { useAccount } from "./use-account"

// Account-backed lists with the same list/set/merge procedures.
type SavedList = "watchlist" | "gemBookmarks" | "itemBookmarks"

const KEYS: Record<SavedList, string> = {
  watchlist: "exile.watchlist",
  gemBookmarks: "exile.gem-bookmarks",
  itemBookmarks: "exile.item-bookmarks",
}

function readLocal(storageKey: string): string[] {
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
  return Array.isArray(saved)
    ? saved.filter((value): value is string => typeof value === "string")
    : []
}

function writeLocal(storageKey: string, next: string[]) {
  if (next.length) localStorage.setItem(storageKey, JSON.stringify(next))
  else localStorage.removeItem(storageKey)
}

// Shared across hook instances (and StrictMode's double effects) so one
// sign-in sends the browser's stars to the account exactly once per list.
const merging = new Map<SavedList, Promise<unknown>>()

/* Starred currencies, or bookmarked gems and items. Without an account, they live in
   localStorage; with one, they live on the account. Stars left in this
   browser are merged into the account once it is created or signed into,
   then cleared locally, so later removals on the account are not undone by a
   stale copy. `storageError` reports a browser that refuses to save, so the
   page can say favorites won't last. */
function useSavedList(name: SavedList) {
  const storageKey = KEYS[name]
  const procedures = useCRPC()[name]
  const queryClient = useQueryClient()
  // A Discord sign-in still awaiting confirmation keeps its stars local.
  const isAuthenticated = useAccount().status === "member"
  const [local, setLocal] = useState<string[]>([])
  const [storageError, setStorageError] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    try {
      setLocal(readLocal(storageKey))
    } catch {
      setStorageError(true)
    }
  }, [storageKey])

  const listKey = procedures.list.queryKey({})
  const account = useQuery(
    procedures.list.queryOptions(isAuthenticated ? {} : skipToken, {
      skipUnauth: true,
    })
  )
  // Star optimistically; the live subscription replaces this with the saved
  // list, and a failed save puts the star back where it was.
  const star = (item: string, watched: boolean) =>
    queryClient.setQueryData<string[]>(listKey, (current = []) =>
      watched
        ? [...current.filter((value) => value !== item), item]
        : current.filter((value) => value !== item)
    )
  const merge = useMutation(procedures.merge.mutationOptions())
  const set = useMutation(
    procedures.set.mutationOptions({
      onMutate: ({ item, watched }) => star(item, watched),
      onError: (_error, { item, watched }) => star(item, !watched),
    })
  )

  const { mutateAsync: mergeAsync } = merge
  useEffect(() => {
    if (!isAuthenticated || !local.length || merging.has(name)) return
    const items = local
    const pending = mergeAsync({ items })
      .then(() => {
        // Keep anything starred locally while the merge was in flight.
        const rest = readLocal(storageKey).filter(
          (value) => !items.includes(value)
        )
        writeLocal(storageKey, rest)
        setLocal(rest)
      })
      .catch(() => {
        // Leave local stars in place; the next visit retries.
      })
      .finally(() => {
        merging.delete(name)
      })
    merging.set(name, pending)
  }, [storageKey, name, isAuthenticated, local, mergeAsync, retryVersion])

  // Until the merge lands, show local stars alongside the account's.
  const favorites = isAuthenticated
    ? [...new Set([...(account.data ?? []), ...local])]
    : local

  const toggleFavorite = (id: string) => {
    const watched = !favorites.includes(id)
    if (isAuthenticated) {
      set.mutate({ item: id, watched })
      // A pending local copy would otherwise re-add an unstarred item.
      if (!watched && local.includes(id)) {
        const next = local.filter((value) => value !== id)
        setLocal(next)
        try {
          writeLocal(storageKey, next)
        } catch {
          setStorageError(true)
        }
      }
      return
    }
    const next = watched
      ? [...local, id]
      : local.filter((value) => value !== id)
    setLocal(next)
    try {
      writeLocal(storageKey, next)
    } catch {
      setStorageError(true)
    }
  }

  return {
    favorites,
    error: account.error ?? set.error ?? merge.error,
    isLoading: isAuthenticated && account.isPending,
    retry: () => {
      set.reset()
      merge.reset()
      setRetryVersion((version) => version + 1)
      void account.refetch()
    },
    toggleFavorite,
    storageError: storageError && !isAuthenticated,
  }
}

export const useWatchlist = () => useSavedList("watchlist")

/* Bookmarked gems, keyed by game id. */
export const useGemBookmarks = () => useSavedList("gemBookmarks")

/* Bookmarked items, keyed by catalogue slug. */
export const useItemBookmarks = () => useSavedList("itemBookmarks")
