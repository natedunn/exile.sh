import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import { bookmarks } from "../functions/schema"
import type { MutationCtx, QueryCtx } from "../functions/generated/server"

// Far above either catalogue's size; it only bounds reads and abusive merges.
export const BOOKMARK_LIMIT = 2000
const item = z.string().trim().min(1).max(200)

/* Inputs match the watchlist's so one client hook drives every list. */
export const listInput = z.object({})
export const setInput = z.object({ item, watched: z.boolean() })
export const mergeInput = z.object({
  items: z.array(item).max(BOOKMARK_LIMIT),
})

export type BookmarkKind = "gem" | "item"

function saved(ctx: QueryCtx, userId: string, kind: BookmarkKind) {
  return ctx.orm.query.bookmarks.findMany({
    where: { userId, kind },
    limit: BOOKMARK_LIMIT,
  })
}

export async function listBookmarks(
  ctx: QueryCtx,
  userId: string,
  kind: BookmarkKind
) {
  return (await saved(ctx, userId, kind)).map((row) => row.item)
}

/* Idempotent rather than a toggle, so a retried or duplicated request from
   another tab cannot flip the bookmark back. */
export async function setBookmark(
  ctx: MutationCtx,
  userId: string,
  kind: BookmarkKind,
  input: z.infer<typeof setInput>
) {
  const existing = await ctx.orm.query.bookmarks.findFirst({
    where: { userId, kind, item: input.item },
  })
  if (input.watched && !existing) {
    if ((await saved(ctx, userId, kind)).length >= BOOKMARK_LIMIT)
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Your bookmarks are full.",
      })
    await ctx.orm.insert(bookmarks).values({ userId, kind, item: input.item })
  }
  if (!input.watched && existing)
    await ctx.orm.delete(bookmarks).where(eq(bookmarks.id, existing.id))
  return null
}

/* Adds a signed-out browser's bookmarks to the account. Union only: what the
   account already has is kept, and nothing on it is removed. */
export async function mergeBookmarks(
  ctx: MutationCtx,
  userId: string,
  kind: BookmarkKind,
  input: z.infer<typeof mergeInput>
) {
  const have = new Set(await listBookmarks(ctx, userId, kind))
  const added = [...new Set(input.items)]
    .filter((value) => !have.has(value))
    .slice(0, Math.max(0, BOOKMARK_LIMIT - have.size))
  if (added.length)
    await ctx.orm
      .insert(bookmarks)
      .values(added.map((value) => ({ userId, kind, item: value })))
  return { added: added.length }
}
