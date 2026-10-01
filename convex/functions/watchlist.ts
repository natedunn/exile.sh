import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import { memberMutation, memberQuery } from "../lib/crpc"
import { watchlist } from "./schema"
import type { QueryCtx } from "./generated/server"

// Far above the catalogue size; it only bounds reads and abusive merges.
export const WATCHLIST_LIMIT = 500
const item = z.string().trim().min(1).max(100)

function saved(ctx: QueryCtx, userId: string) {
  return ctx.orm.query.watchlist.findMany({
    where: { userId },
    limit: WATCHLIST_LIMIT,
  })
}

export const list = memberQuery
  .input(z.object({}))
  .query(async ({ ctx }) =>
    (await saved(ctx, ctx.userId)).map((row) => row.item)
  )

/* Idempotent rather than a toggle, so a retried or duplicated request from
   another tab cannot flip the star back. */
export const set = memberMutation
  .input(z.object({ item, watched: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.watchlist.findFirst({
      where: { userId: ctx.userId, item: input.item },
    })
    if (input.watched && !existing) {
      if ((await saved(ctx, ctx.userId)).length >= WATCHLIST_LIMIT)
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Your watchlist is full.",
        })
      await ctx.orm
        .insert(watchlist)
        .values({ userId: ctx.userId, item: input.item })
    }
    if (!input.watched && existing)
      await ctx.orm.delete(watchlist).where(eq(watchlist.id, existing.id))
    return null
  })

/* Adds a signed-out browser's stars to the account. Union only: an item the
   account already has is kept, and nothing on the account is removed. */
export const merge = memberMutation
  .input(z.object({ items: z.array(item).max(WATCHLIST_LIMIT) }))
  .mutation(async ({ ctx, input }) => {
    const have = new Set((await saved(ctx, ctx.userId)).map((row) => row.item))
    const added = [...new Set(input.items)]
      .filter((value) => !have.has(value))
      .slice(0, Math.max(0, WATCHLIST_LIMIT - have.size))
    if (added.length)
      await ctx.orm
        .insert(watchlist)
        .values(added.map((value) => ({ userId: ctx.userId, item: value })))
    return { added: added.length }
  })
