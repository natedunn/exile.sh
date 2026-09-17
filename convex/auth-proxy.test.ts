/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { beforeEach, afterEach, expect, test, vi } from "vitest"
import schema from "./functions/schema"
const modules = import.meta.glob("./functions/**/*.ts")
const production = "https://exile.sh"
const preview = "https://feature-exile-sh.hello-fc8.workers.dev"
const local = "https://worktree-exile-123abc.localhost:1355"

beforeEach(() => {
  vi.stubEnv("DISCORD_CLIENT_ID", "test-client-id")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret")
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-only-main-secret-at-least-32-characters"
  )
  vi.stubEnv(
    "OAUTH_PROXY_SECRET",
    "test-only-proxy-secret-at-least-32-characters"
  )
  vi.stubEnv("SITE_URL", production)
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
function headers(origin: string, cookie?: string) {
  const url = new URL(origin)
  return {
    "Content-Type": "application/json",
    Origin: origin,
    "x-forwarded-host": url.host,
    "x-forwarded-proto": url.protocol.slice(0, -1),
    ...(cookie ? { Cookie: cookie } : {}),
  }
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

test.each([
  [preview, true],
  [local, true],
  [preview, false],
] as const)(
  "OAuth for %s enforces verification (%s) and backend isolation",
  async (origin, verified) => {
    const relay = convexTest(schema, modules)
    const target = convexTest(schema, modules)
    const start = await target.fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: headers(origin),
      body: JSON.stringify({
        provider: "discord",
        callbackURL: `${origin}/auth`,
        errorCallbackURL: `${origin}/auth`,
        newUserCallbackURL: `${origin}/auth`,
      }),
    })
    expect(start.status).toBe(200)
    const destination = new URL((await start.json()).url)
    expect(destination.searchParams.get("redirect_uri")).toBe(
      `${production}/api/auth/callback/discord`
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = decodeURIComponent(String(input))
        if (url.includes("/oauth2/token"))
          return Response.json({
            access_token: "test",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "identify email",
          })
        if (url.includes("/users/@me"))
          return Response.json({
            id: "123456789012345678",
            username: "exile",
            global_name: "Display",
            discriminator: "0",
            avatar: null,
            email: "verified@example.com",
            verified,
          })
        throw new Error("Unexpected external request")
      })
    )
    const callback = await relay.fetch(
      `/api/auth/callback/discord?code=test&state=${encodeURIComponent(destination.searchParams.get("state")!)}`,
      { headers: headers(production) }
    )
    expect(callback.status).toBe(302)
    if (!verified) {
      expect(
        await relay.run((ctx) => ctx.db.query("user").take(1))
      ).toHaveLength(0)
      expect(
        await target.run((ctx) => ctx.db.query("session").take(1))
      ).toHaveLength(0)
      expect(callback.headers.get("location")).toContain("error=")
      return
    }
    const returned = new URL(callback.headers.get("location")!)
    expect(returned.origin).toBe(origin)
    expect(returned.pathname).toBe("/api/auth/oauth-proxy-callback")
    expect(await relay.run((ctx) => ctx.db.query("user").take(1))).toHaveLength(
      0
    )
    const complete = await target.fetch(returned.pathname + returned.search, {
      headers: headers(origin, cookies(start)),
    })
    expect(complete.status).toBe(302)
    expect(complete.headers.get("location")).toBe(`${origin}/auth`)
    expect(
      await target.run((ctx) => ctx.db.query("user").first())
    ).toMatchObject({ name: "exile", emailVerified: true })
    expect(
      await target.run((ctx) => ctx.db.query("session").take(2))
    ).toHaveLength(1)
    // Exercise the handoff that happens after Better Auth issues its session:
    // obtain the Convex JWT, then verify it using direct public key discovery.
    const tokenResponse = await target.fetch("/api/auth/convex/token", {
      headers: headers(origin, cookies(complete)),
    })
    expect(tokenResponse.status).toBe(200)
    const { token } = await tokenResponse.json()
    const [encodedHeader, encodedPayload, signature] = token.split(".")
    const decode = (part: string) =>
      Uint8Array.from(
        atob(part.replace(/-/g, "+").replace(/_/g, "/")),
        (char) => char.charCodeAt(0)
      )
    const jwtHeader = JSON.parse(
      new TextDecoder().decode(decode(encodedHeader))
    )
    const payload = JSON.parse(new TextDecoder().decode(decode(encodedPayload)))
    expect(payload.iss).toBe("http://localhost:3211")
    expect(payload.aud).toBe("convex")
    const publicKeys = await target.fetch("/api/auth/convex/jwks", {
      headers: {
        "x-forwarded-host": "backend.convex.site",
        "x-forwarded-proto": "https",
      },
    })
    expect(publicKeys.status).toBe(200)
    const { keys } = await publicKeys.json()
    const jwk = keys.find((key: { kid: string }) => key.kid === jwtHeader.kid)
    expect(jwk).toBeDefined()
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    )
    expect(
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        decode(signature),
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
      )
    ).toBe(true)
    await target.fetch(returned.pathname + returned.search, {
      headers: headers(origin, cookies(start)),
    })
    expect(
      await target.run((ctx) => ctx.db.query("session").take(2))
    ).toHaveLength(1)
  }
)

test("rejects a foreign forwarded host before beginning OAuth", async () => {
  const t = convexTest(schema, modules)
  const response = await t.fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: headers("https://attacker.workers.dev"),
    body: JSON.stringify({
      provider: "discord",
      callbackURL: "https://attacker.workers.dev/auth",
    }),
  })
  expect(response.status).toBe(400)
})

test("Convex can fetch public signing keys without a frontend forwarding origin", async () => {
  const t = convexTest(schema, modules)
  const backendHeaders = {
    "x-forwarded-host": "backend.convex.site",
    "x-forwarded-proto": "https",
  }
  const response = await t.fetch("/api/auth/convex/jwks", {
    headers: backendHeaders,
  })
  expect(response.status).toBe(200)
  const { keys } = await response.json()
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) {
    expect(key).toHaveProperty("kid")
    for (const privateField of ["d", "p", "q", "dp", "dq", "qi", "oth"]) {
      expect(key).not.toHaveProperty(privateField)
    }
  }
  const discovery = await t.fetch(
    "/api/auth/convex/.well-known/openid-configuration",
    { headers: backendHeaders }
  )
  expect(discovery.status).toBe(200)
  const signIn = await t.fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { ...backendHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "discord", callbackURL: "/auth" }),
  })
  expect(signIn.status).toBe(400)
  const session = await t.fetch("/api/auth/get-session", {
    headers: backendHeaders,
  })
  expect(session.status).toBe(400)
})
