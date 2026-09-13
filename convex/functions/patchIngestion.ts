import { z } from "zod"
import { privateAction } from "../lib/crpc"
import { createPatchStoreCaller } from "./generated/patchStore.runtime"
import { createPatchIngestionCaller } from "./generated/patchIngestion.runtime"
import {
  PATCH_FORUM,
  parsePatchForum,
  parsePatchPost,
} from "../../shared/forum-news"
import { fetchForum } from "../../shared/fetch-forum"

export const post = privateAction
  .input(z.object({ threadId: z.string().regex(/^\d{1,12}$/) }))
  .action(async ({ ctx, input }) => {
    const store = createPatchStoreCaller(ctx)
    const token = crypto.randomUUID()
    if (!(await store.acquire({ ...input, token }))) return
    try {
      const url = `https://www.pathofexile.com/forum/view-thread/${input.threadId}`
      const parsed = parsePatchPost(await fetchForum(url), url)
      await store.finish({ ...input, token, post: parsed, error: "" })
    } catch (error) {
      const message = (
        error instanceof Error ? error.message : "Unknown forum error"
      ).slice(0, 300)
      console.warn(`Patch ${input.threadId}: ${message}`)
      await store.finish({ ...input, token, error: message })
    }
  })

export const poll = privateAction
  .input(z.object({}))
  .action(async ({ ctx }) => {
    const items = parsePatchForum(await fetchForum(PATCH_FORUM)).slice(0, 100)
    await createPatchStoreCaller(ctx).discover({
      items: items.map((item) => ({
        threadId: item.id.replace("forum-", ""),
        title: item.title,
        publishedAt: item.date,
      })),
    })
    const importer = createPatchIngestionCaller(ctx)
    // Each import has its own transaction, retry time, and lease. Space upstream requests.
    for (const [i, item] of items.entries()) {
      await importer.schedule
        .after(i * 2000)
        .post({ threadId: item.id.replace("forum-", "") })
    }
    return { discovered: items.length }
  })
