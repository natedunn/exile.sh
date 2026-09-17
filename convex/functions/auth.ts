import { oAuthProxy } from "better-auth/plugins/oauth-proxy"
import {
  AUTH_ORIGIN,
  authTrustedOrigins,
  isAuthOrigin,
} from "../../shared/auth-origins"
import { discord } from "better-auth/social-providers"
import { convex } from "kitcn/auth"
import { getEnv } from "../lib/get-env"
import { hasVerifiedDiscordEmail } from "../lib/discord-profile"
import authConfig from "./auth.config"
import { defineAuth } from "./generated/auth"

export default defineAuth((ctx) => {
  const env = getEnv()
  const currentURL =
    "authOrigin" in ctx && typeof ctx.authOrigin === "string"
      ? ctx.authOrigin
      : env.SITE_URL
  if (!isAuthOrigin(currentURL, env.SITE_URL))
    throw new Error("Unrecognized authentication origin")
  const credentials = {
    clientId: env.DISCORD_CLIENT_ID ?? "",
    clientSecret: env.DISCORD_CLIENT_SECRET ?? "",
  }
  const provider = discord(credentials)
  return {
    baseURL: currentURL,
    disabledPaths: ["/update-user"],
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false } },
    socialProviders: {
      discord: {
        ...credentials,
        prompt: "consent",
        // Run for EVERY OAuth callback, including returning accounts. Reject
        // before Better Auth can create/link a user or issue a session.
        getUserInfo: async (tokens) => {
          const result = await provider.getUserInfo(tokens)
          if (!result || !hasVerifiedDiscordEmail(result.data)) return null
          return {
            ...result,
            user: {
              ...result.user,
              email: result.data.email,
              emailVerified: true,
              name: result.data.username,
            },
          }
        },
      },
    },
    plugins: [
      convex({ authConfig, jwks: env.JWKS }),
      ...(env.OAUTH_PROXY_SECRET
        ? [
            oAuthProxy({
              productionURL: AUTH_ORIGIN,
              currentURL,
              secret: env.OAUTH_PROXY_SECRET,
            }),
          ]
        : []),
    ],
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    telemetry: { enabled: false },
    trustedOrigins: [...authTrustedOrigins, env.SITE_URL],
  }
})
