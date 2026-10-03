import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import { ANNOTATION_MERGE_LIMIT } from "../../shared/patch-annotations"
import type { PatchAnnotation } from "../../shared/patch-annotations"
import { useCRPC } from "./convex/crpc"
import { useAccount } from "./use-account"

const KEY = "exile.patchNotes"

// Notes made while signed out, by thread id.
type Saved = Record<string, PatchAnnotation[]>
const EMPTY: Saved = {}
const NONE: PatchAnnotation[] = []

function isAnnotation(value: unknown): value is PatchAnnotation {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    typeof row.start === "number" &&
    typeof row.end === "number" &&
    typeof row.quote === "string" &&
    typeof row.note === "string" &&
    typeof row.createdAt === "number"
  )
}

/* One copy of the browser's notes, shared by every hook instance and
   kept current with other tabs, so the sign-in merge and the open post
   never disagree about what is still local. */
let cache: Saved | undefined
let storageFailed = false
const listeners = new Set<() => void>()

function readLocal(): Saved {
  if (cache) return cache
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}")
    const next: Saved = {}
    if (saved && typeof saved === "object")
      for (const [thread, rows] of Object.entries(saved))
        if (Array.isArray(rows) && rows.some(isAnnotation))
          next[thread] = rows.filter(isAnnotation)
    cache = next
  } catch {
    storageFailed = true
    cache = EMPTY
  }
  return cache
}

function writeLocal(update: (saved: Saved) => Saved) {
  const next = Object.fromEntries(
    Object.entries(update(readLocal())).filter(([, rows]) => rows.length)
  )
  cache = next
  try {
    if (Object.keys(next).length)
      localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    storageFailed = true
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    cache = undefined
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function useLocal() {
  return useSyncExternalStore(subscribe, readLocal, () => EMPTY)
}

const upsert = (rows: PatchAnnotation[], row: PatchAnnotation) =>
  [...rows.filter((value) => value.id !== row.id), row].sort(
    (a, b) => a.start - b.start || a.createdAt - b.createdAt
  )
const without = (rows: PatchAnnotation[], id: string) =>
  rows.filter((value) => value.id !== id)

function dropLocal(threadId: string, id: string) {
  if ((readLocal()[threadId] ?? NONE).some((row) => row.id === id))
    writeLocal((saved) => ({
      ...saved,
      [threadId]: without(saved[threadId] ?? NONE, id),
    }))
}

// Shared across mounts (and StrictMode's double effects) so one sign-in
// sends the browser's notes to the account exactly once.
let merging: Promise<unknown> | undefined

/* Sends notes made while signed out to the account once the visitor
   is a member, wherever they land after signing in, then clears the local
   copy so later removals on the account are not undone by it. */
export function useMergePatchAnnotations() {
  const crpc = useCRPC()
  const isMember = useAccount().status === "member"
  const local = useLocal()
  const { mutateAsync } = useMutation(
    crpc.patchAnnotations.merge.mutationOptions()
  )
  useEffect(() => {
    if (!isMember || merging) return
    const annotations = Object.entries(local)
      .flatMap(([threadId, rows]) =>
        rows.map((annotation) => ({ threadId, annotation }))
      )
      .slice(0, ANNOTATION_MERGE_LIMIT)
    if (!annotations.length) return
    merging = mutateAsync({ annotations })
      .then(() => {
        // Keep any note made locally while the merge was in flight.
        const sent = new Set(annotations.map((row) => row.annotation.id))
        writeLocal((saved) =>
          Object.fromEntries(
            Object.entries(saved).map(([thread, rows]) => [
              thread,
              rows.filter((row) => !sent.has(row.id)),
            ])
          )
        )
      })
      .catch(() => {
        // Leave local notes in place; the next visit retries.
      })
      .finally(() => {
        merging = undefined
      })
  }, [isMember, local, mutateAsync])
}

/* The reader's notes on one patch post. Without an account they live in
   localStorage; with one, on the account. Until the sign-in merge lands,
   local notes show alongside the account's. */
export function usePatchAnnotations(threadId: string) {
  const crpc = useCRPC()
  const queryClient = useQueryClient()
  const status = useAccount().status
  const isMember = status === "member"
  const local = useLocal()[threadId] ?? NONE

  const listKey = crpc.patchAnnotations.list.queryKey({ threadId })
  const account = useQuery(
    crpc.patchAnnotations.list.queryOptions(
      isMember ? { threadId } : skipToken,
      { skipUnauth: true }
    )
  )
  // Saves are optimistic; the live subscription replaces this with the
  // stored list, and a failed save restores what was there before.
  const snapshot = () => queryClient.getQueryData<PatchAnnotation[]>(listKey)
  const restore = (previous: unknown) =>
    queryClient.setQueryData(listKey, previous)
  const save = useMutation(
    crpc.patchAnnotations.save.mutationOptions({
      onMutate: ({ annotation }) => {
        const previous = snapshot()
        queryClient.setQueryData<PatchAnnotation[]>(listKey, (rows = []) =>
          upsert(rows, annotation)
        )
        return previous
      },
      onError: (_error, _input, previous) => restore(previous),
    })
  )
  const remove = useMutation(
    crpc.patchAnnotations.remove.mutationOptions({
      onMutate: ({ id }) => {
        const previous = snapshot()
        queryClient.setQueryData<PatchAnnotation[]>(listKey, (rows = []) =>
          without(rows, id)
        )
        return previous
      },
      onError: (_error, _input, previous) => restore(previous),
    })
  )

  const annotations = useMemo(
    () =>
      isMember
        ? local.reduce(
            (rows, row) =>
              rows.some((value) => value.id === row.id)
                ? rows
                : upsert(rows, row),
            account.data ?? NONE
          )
        : local,
    [isMember, local, account.data]
  )

  const put = (annotation: PatchAnnotation) => {
    if (isMember) {
      save.mutate({ threadId, annotation })
      // The account copy now leads; a pending local one would only shadow it.
      dropLocal(threadId, annotation.id)
      return
    }
    writeLocal((saved) => ({
      ...saved,
      [threadId]: upsert(saved[threadId] ?? NONE, annotation),
    }))
  }

  return {
    annotations,
    isMember,
    // Saving before the account is known could strand a note locally.
    isReady: status !== "loading" && !(isMember && account.isPending),
    error: account.error ?? save.error ?? remove.error,
    storageError: !isMember && storageFailed,
    put,
    remove: (id: string) => {
      if (isMember) remove.mutate({ threadId, id })
      dropLocal(threadId, id)
    },
    retry: () => {
      save.reset()
      remove.reset()
      void account.refetch()
    },
  }
}
