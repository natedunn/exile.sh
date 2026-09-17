import { CRPCError } from "kitcn/server"
import { getHeaders } from "kitcn/auth"
import { getAuth } from "../functions/generated/auth"
import { initCRPC } from "../functions/generated/server"

const c = initCRPC.meta<{ auth?: "optional" | "required" }>().create()
const authenticated = c.middleware(async ({ ctx, next }) => {
  const session = await getAuth(ctx).api.getSession({
    headers: await getHeaders(ctx),
  })
  if (!session?.user)
    throw new CRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in with Discord first.",
    })
  if (!session.user.emailVerified || !session.user.email) {
    throw new CRPCError({
      code: "FORBIDDEN",
      message: "A verified Discord email is required.",
    })
  }
  return next({ ctx: { ...ctx, user: session.user, userId: session.user.id } })
})

export const publicQuery = c.query
export const publicAction = c.action
export const publicMutation = c.mutation
export const authQuery = c.query.meta({ auth: "required" }).use(authenticated)
export const authMutation = c.mutation
  .meta({ auth: "required" })
  .use(authenticated)
export const privateQuery = c.query.internal()
export const privateMutation = c.mutation.internal()
export const privateAction = c.action.internal()
export const publicRoute = c.httpAction
export const router = c.router
