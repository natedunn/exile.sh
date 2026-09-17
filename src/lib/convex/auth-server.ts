import { publicAuthRequest } from "../../../shared/auth-origins"
import { api } from "@convex/api"
import { convexBetterAuthReactStart } from "kitcn/auth/start/server"

export const {
  handler: proxyHandler,
  getToken,
  createCaller,
  createContext,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  api,
  convexUrl: import.meta.env.VITE_CONVEX_URL!,
  convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL!,
})

// Portless/Workers may expose an internal request URL behind their proxy.
// Restore only an allowed public origin before Kitcn forwards the request.
export function handler(request: Request) {
  try {
    return proxyHandler(publicAuthRequest(request))
  } catch {
    return new Response("Unrecognized authentication origin", { status: 400 })
  }
}
