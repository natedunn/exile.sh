import { expect, test, vi } from "vitest"

test("reads auth credentials from Convex's getter-only environment", async () => {
  const { getEnv } = await import("./lib/get-env")
  const values: Record<string, string> = {
    DEPLOY_ENV: "development",
    SITE_URL: "https://exile.localhost:1355",
    DISCORD_CLIENT_ID: "test-client",
    DISCORD_CLIENT_SECRET: "test-secret",
    BETTER_AUTH_SECRET: "a".repeat(32),
    OAUTH_PROXY_SECRET: "b".repeat(32),
    JWKS: "[]",
    CONVEX_SITE_URL: "http://127.0.0.1:31027",
  }
  const env = new Proxy({}, { get: (_, key) => values[String(key)] })
  vi.stubGlobal("process", { env })
  try {
    const result = getEnv()
    for (const [key, value] of Object.entries(values)) {
      expect(result[key as keyof typeof result]).toBe(value)
    }
  } finally {
    vi.unstubAllGlobals()
  }
})
