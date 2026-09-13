import { eq } from "kitcn/orm"
import { z } from "zod"
import { privateMutation, privateQuery, publicQuery } from "../lib/crpc"
import { xPosts, xSync } from "./schema"
import {
  X_ACCOUNT,
  X_DAY,
  X_FAST,
  newestXId,
  nextXPoll,
  storedXPost,
  xId,
} from "../../shared/x-sync"

export const latest = publicQuery.input(z.object({})).query(async ({ ctx }) => {
  const posts = await ctx.orm.query.xPosts.findMany({
    where: { hidden: 0 },
    orderBy: { publishedAt: "desc" },
    limit: 5,
  })
  const state = await ctx.orm.query.xSync.findFirst({
    where: { key: X_ACCOUNT },
  })
  return {
    posts: posts.map((post) => ({
      id: post.postId,
      text: post.body,
      date: new Date(post.publishedAt).toISOString(),
    })),
    unavailable: !state?.lastSuccessAt,
  }
})

export const state = privateQuery
  .input(z.object({}))
  .query(async ({ ctx }) =>
    ctx.orm.query.xSync.findFirst({ where: { key: X_ACCOUNT } })
  )

export const acquire = privateMutation
  .input(z.object({ token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.xSync.findFirst({
      where: { key: X_ACCOUNT },
    })
    const now = Date.now()
    if (row && (row.leaseUntil > now || row.nextPollAt > now)) return null
    const values = {
      key: X_ACCOUNT,
      accountId: row?.accountId ?? "",
      newestId: row?.newestId ?? "",
      pendingNewestId: row?.pendingNewestId ?? "",
      paginationToken: row?.paginationToken ?? "",
      nextPollAt: row?.nextPollAt ?? 0,
      activeUntil: row?.activeUntil ?? 0,
      leaseUntil: now + 5 * 60_000,
      leaseToken: input.token,
      failures: row?.failures ?? 0,
      lastError: row?.lastError ?? "",
      lastSuccessAt: row?.lastSuccessAt ?? 0,
    }
    if (row) await ctx.orm.update(xSync).set(values).where(eq(xSync.id, row.id))
    else await ctx.orm.insert(xSync).values(values)
    return values
  })

export const rememberAccount = privateMutation
  .input(z.object({ token: z.string(), accountId: xId }))
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.xSync.findFirst({
      where: { key: X_ACCOUNT },
    })
    if (!row || row.leaseToken !== input.token || row.leaseUntil <= Date.now())
      return false
    await ctx.orm
      .update(xSync)
      .set({ accountId: input.accountId })
      .where(eq(xSync.id, row.id))
    return true
  })

export const savePage = privateMutation
  .input(
    z.object({
      token: z.string(),
      posts: z.array(storedXPost).max(100),
      nextToken: z.string().max(2000),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.xSync.findFirst({
      where: { key: X_ACCOUNT },
    })
    const now = Date.now()
    if (
      !row ||
      row.leaseToken !== input.token ||
      row.leaseUntil <= now ||
      !row.accountId
    )
      return false
    let activeUntil = row.activeUntil
    for (const post of input.posts) {
      const existing = await ctx.orm.query.xPosts.findFirst({
        where: { postId: post.id },
      })
      const publishedAt = Date.parse(post.created_at)
      const values = {
        postId: post.id,
        accountId: row.accountId,
        body: post.text,
        publishedAt,
        originalUrl: `https://x.com/${X_ACCOUNT}/status/${post.id}`,
        editIds: post.edit_history_tweet_ids,
        fetchedAt: now,
        hidden: existing?.hidden ?? 0,
      }
      if (existing)
        await ctx.orm
          .update(xPosts)
          .set(values)
          .where(eq(xPosts.id, existing.id))
      else await ctx.orm.insert(xPosts).values(values)
      activeUntil = Math.max(activeUntil, Math.min(publishedAt, now) + X_DAY)
      for (const oldId of post.edit_history_tweet_ids) {
        if (oldId === post.id) continue
        await ctx.orm
          .update(xPosts)
          .set({ hidden: 1 })
          .where(eq(xPosts.postId, oldId))
      }
    }
    const pendingNewestId = newestXId(
      row.pendingNewestId,
      row.newestId,
      ...input.posts.map((post) => post.id)
    )
    const finished = !input.nextToken
    await ctx.orm
      .update(xSync)
      .set({
        paginationToken: input.nextToken,
        pendingNewestId: finished ? "" : pendingNewestId,
        newestId: finished ? pendingNewestId : row.newestId,
        activeUntil,
        failures: 0,
        lastError: "",
        lastSuccessAt: now,
        nextPollAt: finished ? nextXPoll(now, activeUntil) : now + X_FAST,
        leaseUntil: finished ? 0 : row.leaseUntil,
      })
      .where(eq(xSync.id, row.id))
    return true
  })

export const release = privateMutation
  .input(
    z.object({
      token: z.string(),
      error: z.string().max(200),
      retryAt: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const row = await ctx.orm.query.xSync.findFirst({
      where: { key: X_ACCOUNT },
    })
    if (!row || row.leaseToken !== input.token || row.leaseUntil === 0) return
    const now = Date.now()
    const failures = input.error ? row.failures + 1 : 0
    await ctx.orm
      .update(xSync)
      .set({
        leaseUntil: 0,
        failures,
        lastError: input.error,
        nextPollAt: Math.max(
          input.error
            ? nextXPoll(now, row.activeUntil, failures)
            : now + X_FAST,
          Math.min(input.retryAt ?? 0, now + X_DAY)
        ),
      })
      .where(eq(xSync.id, row.id))
  })

// Administrative correction path: callable only with deployment credentials.
export const hide = privateMutation
  .input(z.object({ postId: xId, hidden: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.orm
      .update(xPosts)
      .set({ hidden: input.hidden ? 1 : 0 })
      .where(eq(xPosts.postId, input.postId))
  })
