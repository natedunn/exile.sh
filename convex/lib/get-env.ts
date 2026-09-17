import { createEnv } from "kitcn/server"
import * as z from "zod"

const envSchema = z.object({
  DEPLOY_ENV: z.string().default("production"),
  SITE_URL: z.string().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  OAUTH_PROXY_SECRET: z.string().min(32).optional(),
  JWKS: z.string().optional(),
  CONVEX_SITE_URL: z.string().optional(),
})

export const getEnv = createEnv({
  schema: envSchema,
  // Convex exposes env values through getters, not enumerable own properties.
  readOptionalRuntimeEnv: [
    "BETTER_AUTH_SECRET",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "OAUTH_PROXY_SECRET",
    "JWKS",
    "CONVEX_SITE_URL",
  ],
})
