import { eq } from "kitcn/orm"
import { z } from "zod"
import { privateMutation, publicQuery } from "../lib/crpc"
import { patchThreads, patchBodies } from "./schema"

const threadId = z.string().regex(/^\d{1,12}$/)
export const latest = publicQuery.input(z.object({})).query(async ({ ctx }) => {
  const rows = await ctx.orm.query.patchThreads.findMany({
    orderBy: { publishedAt: "desc" },
    limit: 100,
  })
  return {
    items: rows.map((row) => ({
      id: `forum-${row.threadId}`,
      title: row.title,
      date: row.publishedAt,
      url: `https://www.pathofexile.com/forum/view-thread/${row.threadId}`,
      kind: "patch" as const,
      excerpt: "",
    })),
    unavailable: rows.length === 0,
  }
})
export const post = publicQuery
  .input(z.object({ threadId }))
  .query(async ({ ctx, input }) => {
    const row = await ctx.orm.query.patchBodies.findFirst({ where: input })
    return row ? { title: row.title, html: row.html } : null
  })
export const discover = privateMutation
  .input(
    z.object({
      items: z
        .array(
          z.object({ threadId, title: z.string(), publishedAt: z.number() })
        )
        .max(100),
    })
  )
  .mutation(async ({ ctx, input }) => {
    for (const item of input.items) {
      const row = await ctx.orm.query.patchThreads.findFirst({
        where: { threadId: item.threadId },
      })
      if (row)
        await ctx.orm
          .update(patchThreads)
          .set({ title: item.title, publishedAt: item.publishedAt })
          .where(eq(patchThreads.id, row.id))
      else
        await ctx.orm
          .insert(patchThreads)
          .values({
            ...item,
            nextFetchAt: 0,
            leaseToken: "",
            lastError: "",
            fetchedAt: 0,
          })
    }
  })
export const acquire = privateMutation
  .input(z.object({ threadId, token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.patchThreads.findFirst({
      where: { threadId: input.threadId },
    })
    if (!row || row.nextFetchAt > Date.now()) return false
    await ctx.orm
      .update(patchThreads)
      .set({ nextFetchAt: Date.now() + 5 * 60_000, leaseToken: input.token })
      .where(eq(patchThreads.id, row.id))
    return true
  })
export const finish = privateMutation
  .input(
    z.object({
      threadId,
      token: z.string(),
      post: z.object({ title: z.string(), html: z.string() }).optional(),
      error: z.string().max(300),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.patchThreads.findFirst({
      where: { threadId: input.threadId },
    })
    if (!row || row.leaseToken !== input.token) return
    if (input.post) {
      // Keep documents below Convex's 1 MiB limit, including UTF-8 overhead.
      if (new TextEncoder().encode(input.post.html).length > 900_000)
        throw new Error("Patch body exceeds storage limit")
      const body = await ctx.orm.query.patchBodies.findFirst({
        where: { threadId: input.threadId },
      })
      if (body)
        await ctx.orm
          .update(patchBodies)
          .set(input.post)
          .where(eq(patchBodies.id, body.id))
      else
        await ctx.orm
          .insert(patchBodies)
          .values({ threadId: input.threadId, ...input.post })
    }
    const hour = 3_600_000
    const interval = !input.post
      ? hour
      : Date.now() - row.publishedAt < 7 * 24 * hour
        ? 6 * hour
        : 7 * 24 * hour
    await ctx.orm
      .update(patchThreads)
      .set({
        nextFetchAt: Date.now() + interval,
        leaseToken: "",
        lastError: input.error,
        fetchedAt: input.post ? Date.now() : row.fetchedAt,
      })
      .where(eq(patchThreads.id, row.id))
  })
