import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "kitcn/react"
import { useEffect, useState } from "react"
import { useCRPC } from "./convex/crpc"

const KEY = "exile.watchlist"

function readLocal(): string[] {
  const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")
  return Array.isArray(saved)
    ? saved.filter((value): value is string => typeof value === "string")
    : []
}

function writeLocal(next: string[]) {
  if (next.length) localStorage.setItem(KEY, JSON.stringify(next))
  else localStorage.removeItem(KEY)
}

// Shared across hook instances (and StrictMode's double effects) so one
// sign-in sends the browser's stars to the account exactly once.
let merging: Promise<unknown> | undefined

/* Starred currencies. Signed out, they live in localStorage; signed in, they
   live on the account. Stars left in this browser while signed out are
   merged into the account on sign-in and then cleared locally, so later
   removals on the account are not undone by a stale copy. `storageError`
   reports a browser that refuses to save, so the page can say favorites
   won't last. */
export function useWatchlist() {
  const crpc = useCRPC()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const [local, setLocal] = useState<string[]>([])
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    try {
      setLocal(readLocal())
    } catch {
      setStorageError(true)
    }
  }, [])

  const listKey = crpc.watchlist.list.queryKey({})
  const account = useQuery(
    crpc.watchlist.list.queryOptions({}, { skipUnauth: true })
  )
  // Star optimistically; the live subscription replaces this with the saved
  // list, and a failed save puts the star back where it was.
  const star = (item: string, watched: boolean) =>
    queryClient.setQueryData<string[]>(listKey, (current = []) =>
      watched
        ? [...current.filter((value) => value !== item), item]
        : current.filter((value) => value !== item)
    )
  const merge = useMutation(crpc.watchlist.merge.mutationOptions())
  const set = useMutation(
    crpc.watchlist.set.mutationOptions({
      onMutate: ({ item, watched }) => star(item, watched),
      onError: (_error, { item, watched }) => star(item, !watched),
    })
  )

  const { mutateAsync: mergeAsync } = merge
  useEffect(() => {
    if (!isAuthenticated || !local.length || merging) return
    const items = local
    merging = mergeAsync({ items })
      .then(() => {
        // Keep anything starred locally while the merge was in flight.
        const rest = readLocal().filter((value) => !items.includes(value))
        writeLocal(rest)
        setLocal(rest)
      })
      .catch(() => {
        // Leave local stars in place; the next visit retries.
      })
      .finally(() => {
        merging = undefined
      })
  }, [isAuthenticated, local, mergeAsync])

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
          writeLocal(next)
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
      writeLocal(next)
    } catch {
      setStorageError(true)
    }
  }

  return {
    favorites,
    toggleFavorite,
    storageError: storageError && !isAuthenticated,
  }
}
