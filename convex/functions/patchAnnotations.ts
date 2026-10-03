import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { eq } from "kitcn/orm"
import { memberMutation, memberQuery } from "../lib/crpc"
import {
  ANNOTATION_MERGE_LIMIT,
  ANNOTATIONS_PER_THREAD,
  NOTE_MAX,
  QUOTE_MAX,
  THREAD_ID,
} from "../../shared/patch-annotations"
import { patchAnnotations } from "./schema"
import type { QueryCtx } from "./generated/server"

const threadId = z.string().regex(THREAD_ID)
const annotation = z
  .object({
    id: z.string().trim().min(1).max(64),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    quote: z.string().min(1).max(QUOTE_MAX),
    note: z.string().max(NOTE_MAX),
    createdAt: z.number().int().min(0),
  })
  .refine((value) => value.end > value.start, "A note must mark some text.")

function saved(ctx: QueryCtx, userId: string, thread: string) {
  return ctx.orm.query.patchAnnotations.findMany({
    where: { userId, threadId: thread },
    limit: ANNOTATIONS_PER_THREAD,
  })
}

function toRow({ createdAt, ...rest }: z.infer<typeof annotation>) {
  return { ...rest, markedAt: createdAt }
}

function full(): never {
  throw new CRPCError({
    code: "BAD_REQUEST",
    message: "This post has too many notes.",
  })
}

export const list = memberQuery
  .input(z.object({ threadId }))
  .query(async ({ ctx, input }) =>
    (await saved(ctx, ctx.userId, input.threadId))
      .map(({ annotationId, start, end, quote, note, markedAt }) => ({
        id: annotationId,
        start,
        end,
        quote,
        note,
        createdAt: markedAt,
      }))
      .sort((a, b) => a.start - b.start || a.createdAt - b.createdAt)
  )

/* Creates or rewrites one note. Keyed by the browser's id, so a
   retried save lands on the same row instead of adding a second. */
export const save = memberMutation
  .input(z.object({ threadId, annotation }))
  .mutation(async ({ ctx, input }) => {
    const { id, ...values } = toRow(input.annotation)
    const existing = await ctx.orm.query.patchAnnotations.findFirst({
      where: {
        userId: ctx.userId,
        threadId: input.threadId,
        annotationId: id,
      },
    })
    if (existing) {
      await ctx.orm
        .update(patchAnnotations)
        .set(values)
        .where(eq(patchAnnotations.id, existing.id))
      return null
    }
    if (
      (await saved(ctx, ctx.userId, input.threadId)).length >=
      ANNOTATIONS_PER_THREAD
    )
      full()
    await ctx.orm.insert(patchAnnotations).values({
      ...values,
      userId: ctx.userId,
      threadId: input.threadId,
      annotationId: id,
    })
    return null
  })

export const remove = memberMutation
  .input(z.object({ threadId, id: z.string().min(1).max(64) }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.patchAnnotations.findFirst({
      where: {
        userId: ctx.userId,
        threadId: input.threadId,
        annotationId: input.id,
      },
    })
    if (existing)
      await ctx.orm
        .delete(patchAnnotations)
        .where(eq(patchAnnotations.id, existing.id))
    return null
  })

/* Adds a signed-out browser's notes to the account. Union only: a
   note the account already has keeps the account's copy, and nothing
   on the account is removed. */
export const merge = memberMutation
  .input(
    z.object({
      annotations: z
        .array(z.object({ threadId, annotation }))
        .max(ANNOTATION_MERGE_LIMIT),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const byThread = new Map<string, (typeof input.annotations)[number][]>()
    for (const row of input.annotations)
      byThread.set(row.threadId, [...(byThread.get(row.threadId) ?? []), row])
    let added = 0
    for (const [thread, rows] of byThread) {
      const have = await saved(ctx, ctx.userId, thread)
      const ids = new Set(have.map((row) => row.annotationId))
      const fresh = rows
        .map((row) => row.annotation)
        .filter((row) => !ids.has(row.id) && ids.add(row.id))
        .slice(0, Math.max(0, ANNOTATIONS_PER_THREAD - have.length))
      if (!fresh.length) continue
      await ctx.orm.insert(patchAnnotations).values(
        fresh.map((value) => {
          const { id, ...values } = toRow(value)
          return {
            ...values,
            userId: ctx.userId,
            threadId: thread,
            annotationId: id,
          }
        })
      )
      added += fresh.length
    }
    return { added }
  })
