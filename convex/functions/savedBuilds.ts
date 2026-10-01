import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { memberMutation, memberQuery } from "../lib/crpc"
import { saveBuildBookmark, SAVED_BUILD_LIMIT } from "../lib/saved-builds"
import { savedBuilds } from "./schema"

export const list = memberQuery.input(z.object({})).query(async ({ ctx }) => {
  const rows = await ctx.orm.query.savedBuilds.findMany({
    where: { userId: ctx.userId },
    orderBy: { savedAt: "desc" },
    limit: SAVED_BUILD_LIMIT,
  })
  return rows.map(({ slug, title, character, level, skill, savedAt }) => ({
    slug,
    title,
    character,
    level,
    skill,
    savedAt,
  }))
})

export const status = memberQuery
  .input(z.object({ slug: z.string().uuid() }))
  .query(async ({ ctx, input }) =>
    Boolean(
      await ctx.orm.query.savedBuilds.findFirst({
        where: { userId: ctx.userId, slug: input.slug },
      })
    )
  )

export const set = memberMutation
  .input(z.object({ slug: z.string().uuid(), saved: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    if (!input.saved) {
      const existing = await ctx.orm.query.savedBuilds.findFirst({
        where: { userId: ctx.userId, slug: input.slug },
      })
      if (existing)
        await ctx.orm.delete(savedBuilds).where(eq(savedBuilds.id, existing.id))
      return null
    }
    const build = await ctx.orm.query.builds.findFirst({
      where: { slug: input.slug },
    })
    if (!build)
      throw new CRPCError({ code: "NOT_FOUND", message: "Build not found." })
    await saveBuildBookmark(ctx, ctx.userId, build)
    return null
  })
