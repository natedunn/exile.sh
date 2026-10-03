import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { useCRPC } from "./convex/crpc"
import { useAccount } from "./use-account"

/* What the reader has already seen on the patch notes page: the publish
   time of the newest patch post and X post shown to them, whether they
   want the New badge, and whether X posts count toward it. */
export type ReadState = {
  patchSeenAt: number
  xSeenAt: number
  badge: boolean
  includeX: boolean
}

const KEY = "exile.patchNotesSeen"

type Local = { available: boolean; state: ReadState | null }
// Until the browser is asked, there is no badge: the server render agrees.
const UNASKED: Local = { available: false, state: null }

let cache: Local | undefined
const listeners = new Set<() => void>()

function isReadState(value: unknown): value is ReadState {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.patchSeenAt === "number" &&
    typeof row.xSeenAt === "number" &&
    typeof row.badge === "boolean" &&
    typeof row.includeX === "boolean"
  )
}

/* A browser that will not store anything gets no badge at all: without a
   memory of what was read, every visit would look new. */
function readLocal(): Local {
  if (cache) return cache
  try {
    localStorage.setItem(`${KEY}.probe`, "1")
    localStorage.removeItem(`${KEY}.probe`)
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null")
    cache = { available: true, state: isReadState(saved) ? saved : null }
  } catch {
    cache = { available: false, state: null }
  }
  return cache
}

function writeLocal(state: ReadState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
    cache = { available: true, state }
  } catch {
    cache = { available: false, state: null }
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return
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

// Seen times only move forward, so a stale tab cannot revive a badge.
function advance(state: ReadState, change: Partial<ReadState>): ReadState {
  return {
    patchSeenAt: Math.max(state.patchSeenAt, change.patchSeenAt ?? 0),
    xSeenAt: Math.max(state.xSeenAt, change.xSeenAt ?? 0),
    badge: change.badge ?? state.badge,
    includeX: change.includeX ?? state.includeX,
  }
}

// Shared across mounts so one sign-in merges the browser's state once.
let merging: Promise<unknown> | undefined

/* Whether there are patch notes (and, if the reader asks, X posts) newer
   than the last time they opened the patch notes page. Signed out, the
   memory lives in localStorage; signed in, on the account, and the
   browser's copy is merged in and cleared once. A first visit starts from
   the newest post, so nothing is new until something is published. */
export function usePatchFreshness() {
  const crpc = useCRPC()
  const queryClient = useQueryClient()
  const status = useAccount().status
  const isMember = status === "member"
  const local = useSyncExternalStore(subscribe, readLocal, () => UNASKED)
  const newest = useQuery(crpc.patchStore.newest.queryOptions({}))
  const account = useQuery(
    crpc.patchReadState.get.queryOptions(isMember ? {} : skipToken, {
      skipUnauth: true,
    })
  )
  const stateKey = crpc.patchReadState.get.queryKey({})
  const save = useMutation(
    crpc.patchReadState.save.mutationOptions({
      onMutate: (change) =>
        queryClient.setQueryData<ReadState | null>(stateKey, (current) =>
          current ? advance(current, change ?? {}) : current
        ),
    })
  )
  const { mutateAsync: mergeAsync } = useMutation(
    crpc.patchReadState.merge.mutationOptions()
  )

  const available =
    isMember || (status !== "loading" && status !== "error" && local.available)
  const loaded = isMember ? account.isSuccess : status !== "loading"
  const state = isMember ? (account.data ?? null) : local.state

  /* Saves only what moves the state forward, so pages can report what
     they showed on every render without writing each time. Stable, so
     effects can depend on it. */
  const live = useRef({ available, isMember, state, saveState: save.mutate })
  live.current = { available, isMember, state, saveState: save.mutate }
  const update = useCallback((change: Partial<ReadState>) => {
    const now = live.current
    const current = now.isMember ? now.state : readLocal().state
    if (!now.available || !current) return
    const next = advance(current, change)
    if (
      next.patchSeenAt === current.patchSeenAt &&
      next.xSeenAt === current.xSeenAt &&
      next.badge === current.badge &&
      next.includeX === current.includeX
    )
      return
    if (now.isMember) now.saveState(change)
    else writeLocal(next)
  }, [])
  const markSeen = useCallback(
    (seen: { patch?: number | null; x?: number | null }) =>
      update({
        patchSeenAt: seen.patch ?? undefined,
        xSeenAt: seen.x ?? undefined,
      }),
    [update]
  )

  useEffect(() => {
    if (!isMember || !local.state || merging) return
    const browser = local.state
    merging = mergeAsync(browser)
      .then(() => writeLocal(null))
      .catch(() => {
        // Keep the browser's copy; the next visit retries.
      })
      .finally(() => {
        merging = undefined
      })
  }, [isMember, local.state, mergeAsync])

  // Start a first-time reader from the newest post: nothing is new yet.
  const { mutate: saveState } = save
  const latest = newest.data
  useEffect(() => {
    if (!available || !loaded || state || !latest) return
    if (isMember && local.state) return
    const start = {
      patchSeenAt: latest.patch ?? 0,
      xSeenAt: latest.x ?? 0,
      badge: true,
      includeX: false,
    }
    if (isMember) saveState(start)
    else if (!readLocal().state) writeLocal(start)
  }, [available, loaded, state, latest, isMember, local.state, saveState])

  // The settings belong to the account; a signed-out browser always gets
  // the badge, for patch notes alone.
  const enabled = available && !!state && (!isMember || state.badge)
  const includeX = enabled && isMember && state.includeX
  const newPatch =
    latest?.patch != null && !!state && latest.patch > state.patchSeenAt
  const newX = latest?.x != null && includeX && latest.x > state.xSeenAt
  return {
    available,
    enabled,
    includeX,
    state,
    newest: latest,
    hasNew: enabled && (newPatch || newX),
    markSeen,
    setBadge: (badge: boolean) => update({ badge }),
    setIncludeX: (value: boolean) => update({ includeX: value }),
  }
}
