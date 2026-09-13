import { z } from "zod"

export const X_ACCOUNT = "pathofexile"
export const X_HOUR = 60 * 60_000
export const X_DAY = 24 * X_HOUR
export const X_FAST = 15 * 60_000
export const xId = z.string().regex(/^\d{1,19}$/)
export const storedXPost = z.object({
  id: xId,
  text: z.string().max(100_000),
  created_at: z.iso.datetime(),
  edit_history_tweet_ids: z.array(xId).max(20).default([]),
})
export const xTimeline = z
  .object({
    data: z.array(storedXPost).max(100).optional(),
    meta: z.object({
      result_count: z.number().int().nonnegative(),
      next_token: z.string().max(2000).optional(),
    }),
  })
  .refine(
    (value) => (value.data?.length ?? 0) === value.meta.result_count,
    "Missing X posts"
  )

export function newestXId(...ids: string[]) {
  return ids.reduce(
    (latest, id) =>
      id && (!latest || BigInt(id) > BigInt(latest)) ? id : latest,
    ""
  )
}
export function nextXPoll(now: number, activeUntil: number, failures = 0) {
  return (
    now +
    (failures
      ? Math.min(X_DAY, X_FAST * 2 ** Math.min(failures - 1, 7))
      : activeUntil > now
        ? X_FAST
        : X_HOUR)
  )
}
