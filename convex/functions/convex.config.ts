import { defineApp } from "convex/server"
import { v } from "convex/values"

export default defineApp({
  env: {
    X_BEARER_TOKEN: v.optional(v.string()),
    X_POLL_ENABLED: v.optional(v.string()),
  },
})
