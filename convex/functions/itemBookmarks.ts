import { memberMutation, memberQuery } from "../lib/crpc"
import {
  listBookmarks,
  listInput,
  mergeBookmarks,
  mergeInput,
  setBookmark,
  setInput,
} from "../lib/bookmarks"

export const list = memberQuery
  .input(listInput)
  .query(({ ctx }) => listBookmarks(ctx, ctx.userId, "item"))

export const set = memberMutation
  .input(setInput)
  .mutation(({ ctx, input }) => setBookmark(ctx, ctx.userId, "item", input))

export const merge = memberMutation
  .input(mergeInput)
  .mutation(({ ctx, input }) => mergeBookmarks(ctx, ctx.userId, "item", input))
