import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import { memberMutation, memberQuery } from "../lib/crpc"
import { gemFavorites } from "./schema"
import type { QueryCtx } from "./generated/server"

// Far above the catalogue size; it only bounds reads and abusive merges.
export const GEM_FAVORITES_LIMIT = 1500
const gem = z.string().trim().min(1).max(200)

function saved(ctx: QueryCtx, userId: string) {
  return ctx.orm.query.gemFavorites.findMany({
    where: { userId },
    limit: GEM_FAVORITES_LIMIT,
  })
}

export const list = memberQuery
  .input(z.object({}))
  .query(async ({ ctx }) =>
    (await saved(ctx, ctx.userId)).map((row) => row.gem)
  )

/* Idempotent rather than a toggle, so a retried or duplicated request from
   another tab cannot flip the favorite back. */
export const set = memberMutation
  .input(z.object({ item: gem, watched: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.gemFavorites.findFirst({
      where: { userId: ctx.userId, gem: input.item },
    })
    if (input.watched && !existing) {
      if ((await saved(ctx, ctx.userId)).length >= GEM_FAVORITES_LIMIT)
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Your favorite gems are full.",
        })
      await ctx.orm
        .insert(gemFavorites)
        .values({ userId: ctx.userId, gem: input.item })
    }
    if (!input.watched && existing)
      await ctx.orm.delete(gemFavorites).where(eq(gemFavorites.id, existing.id))
    return null
  })

/* Adds a signed-out browser's favorites to the account. Union only: a gem
   the account already has is kept, and nothing on the account is removed. */
export const merge = memberMutation
  .input(z.object({ items: z.array(gem).max(GEM_FAVORITES_LIMIT) }))
  .mutation(async ({ ctx, input }) => {
    const have = new Set((await saved(ctx, ctx.userId)).map((row) => row.gem))
    const added = [...new Set(input.items)]
      .filter((value) => !have.has(value))
      .slice(0, Math.max(0, GEM_FAVORITES_LIMIT - have.size))
    if (added.length)
      await ctx.orm
        .insert(gemFavorites)
        .values(added.map((value) => ({ userId: ctx.userId, gem: value })))
    return { added: added.length }
  })
