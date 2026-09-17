import { forwardedAuthOrigin, isAuthOrigin } from "../../shared/auth-origins"
import { getEnv } from "../lib/get-env"
import { getAuth } from "./generated/auth"
import { cors } from "hono/cors"
import { authMiddleware } from "kitcn/auth/http"
import { createHttpRouter } from "kitcn/server"
import { Hono } from "hono"
import { router } from "../lib/crpc"
// __KITCN_HTTP_IMPORTS__

const app = new Hono()
app.use(
  "/api/*",
  cors({
    origin: (origin) =>
      isAuthOrigin(origin, getEnv().SITE_URL) ? origin : undefined,
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    exposeHeaders: ["Set-Better-Auth-Cookie"],
    credentials: true,
  })
)
app.use(async (c, next) => {
  if (!c.req.path.startsWith("/api/auth/"))
    return authMiddleware(getAuth)(c, next)
  let authOrigin: string
  try {
    // The Start proxy overwrites these headers from its own request URL.
    // Validate again here because the Convex HTTP endpoint is also public.
    authOrigin = forwardedAuthOrigin(c.req.raw.headers, getEnv().SITE_URL)
  } catch {
    return c.text("Unrecognized authentication origin", 400)
  }
  return authMiddleware((ctx: Parameters<typeof getAuth>[0]) => {
    const requestContext = { ...ctx, authOrigin }
    return getAuth(requestContext)
  })(c, next)
})

export const httpRouter = router({
  // __KITCN_HTTP_ROUTES__
})

export default createHttpRouter(app, httpRouter)
