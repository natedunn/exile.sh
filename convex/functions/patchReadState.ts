import { z } from "zod"
import { eq } from "kitcn/orm"
import { memberMutation, memberQuery } from "../lib/crpc"
import { patchReadState } from "./schema"
import type { QueryCtx } from "./generated/server"

const seenAt = z.number().int().min(0)

function current(ctx: QueryCtx, userId: string) {
  return ctx.orm.query.patchReadState.findFirst({ where: { userId } })
}

export const get = memberQuery.input(z.object({})).query(async ({ ctx }) => {
  const row = await current(ctx, ctx.userId)
  return row
    ? {
        patchSeenAt: row.patchSeenAt,
        xSeenAt: row.xSeenAt,
        badge: row.badge,
        includeX: row.includeX,
      }
    : null
})

/* Records what the member has seen and their settings. Seen times only
   move forward, so a stale tab cannot bring back a badge already
   cleared; a first save without them starts from now, with nothing new. */
export const save = memberMutation
  .input(
    z.object({
      patchSeenAt: seenAt.optional(),
      xSeenAt: seenAt.optional(),
      badge: z.boolean().optional(),
      includeX: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await current(ctx, ctx.userId)
    if (!row) {
      const now = Date.now()
      await ctx.orm.insert(patchReadState).values({
        userId: ctx.userId,
        patchSeenAt: input.patchSeenAt ?? now,
        xSeenAt: input.xSeenAt ?? now,
        badge: input.badge ?? true,
        includeX: input.includeX ?? false,
      })
      return null
    }
    await ctx.orm
      .update(patchReadState)
      .set({
        patchSeenAt: Math.max(row.patchSeenAt, input.patchSeenAt ?? 0),
        xSeenAt: Math.max(row.xSeenAt, input.xSeenAt ?? 0),
        badge: input.badge ?? row.badge,
        includeX: input.includeX ?? row.includeX,
      })
      .where(eq(patchReadState.id, row.id))
    return null
  })

/* Brings a signed-out browser's state to the account. An account that
   already has settings keeps them; seen times take the later of the two. */
export const merge = memberMutation
  .input(
    z.object({
      patchSeenAt: seenAt,
      xSeenAt: seenAt,
      badge: z.boolean(),
      includeX: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await current(ctx, ctx.userId)
    if (!row) {
      await ctx.orm
        .insert(patchReadState)
        .values({ ...input, userId: ctx.userId })
      return null
    }
    await ctx.orm
      .update(patchReadState)
      .set({
        patchSeenAt: Math.max(row.patchSeenAt, input.patchSeenAt),
        xSeenAt: Math.max(row.xSeenAt, input.xSeenAt),
      })
      .where(eq(patchReadState.id, row.id))
    return null
  })
