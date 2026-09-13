import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@convex/api"
import type { NewsItem } from "../../shared/news"

// Visitors only read saved data. Scheduled Convex actions own forum requests.
export const getPatchNotes = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return await new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL).query(
        api.patchStore.latest.functionRef,
        {}
      )
    } catch {
      return { items: [] as NewsItem[], unavailable: true }
    }
  }
)

export const getPatchPost = createServerFn({ method: "GET" })
  .validator(z.object({ threadId: z.string().regex(/^\d{1,12}$/) }))
  .handler(async ({ data }) => {
    const url = `https://www.pathofexile.com/forum/view-thread/${data.threadId}`
    try {
      const post = await new ConvexHttpClient(
        import.meta.env.VITE_CONVEX_URL
      ).query(api.patchStore.post.functionRef, data)
      return { post, url }
    } catch {
      return { post: null, url }
    }
  })

// Page requests read persisted posts only; the Convex cron owns X API access.
export const getXUpdates = createServerFn({ method: "GET" }).handler(
  async () => {
    const url = import.meta.env.VITE_CONVEX_URL
    if (!url) return { posts: [], unavailable: true }
    try {
      return await new ConvexHttpClient(url).query(
        api.xStore.latest.functionRef,
        {}
      )
    } catch {
      return { posts: [], unavailable: true }
    }
  }
)
