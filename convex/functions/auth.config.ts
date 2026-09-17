import { getAuthConfigProvider } from "kitcn/auth/config"
import type { AuthConfig } from "convex/server"

// Convex evaluates this before the first deployment, when app env vars may
// not exist yet. Do not load getEnv(): its defaults read unrelated keys.
// Even an optional process.env read must be guarded during auth analysis.
const jwks = Object.hasOwn(process.env, "JWKS") ? process.env.JWKS : undefined

export default {
  providers: [jwks ? getAuthConfigProvider({ jwks }) : getAuthConfigProvider()],
} satisfies AuthConfig
