import { createServerFn } from "@tanstack/react-start"
import { ConvexHttpClient } from "convex/browser"
import { z } from "zod"
import { api } from "@convex/api"

export const getSharedBuild = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().uuid() }))
  .handler(async ({ data }) => {
    const url = import.meta.env.VITE_CONVEX_URL
    if (!url) throw new Error("Build storage is not configured.")
    return new ConvexHttpClient(url).query(api.builds.get.functionRef, data)
  })
