/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { beforeEach, afterEach, expect, test, vi } from "vitest"
import schema from "./functions/schema"
import { api } from "./shared/api"
import { hasVerifiedDiscordEmail, usernameBase } from "./lib/discord-profile"
const modules = import.meta.glob("./functions/**/*.ts")
beforeEach(() => {
  vi.stubEnv("DISCORD_CLIENT_ID", "test-client-id")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret")
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-only-secret-at-least-thirty-two-characters"
  )
  vi.stubEnv("SITE_URL", "http://localhost:3000")
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211")
})
afterEach(() => vi.unstubAllEnvs())

test.each([
  { email: null, verified: true },
  { email: "", verified: true },
  { email: "user@example.com", verified: false },
  { email: "user@example.com" },
  { email: "user@example.com", verified: "true" },
  { email: "invalid", verified: true },
])("rejects missing or unverified Discord email: %j", (profile) => {
  expect(hasVerifiedDiscordEmail(profile)).toBe(false)
})
test("accepts only a verified email and normalizes Discord usernames", () => {
  expect(
    hasVerifiedDiscordEmail({ email: "user@example.com", verified: true })
  ).toBe(true)
  expect(usernameBase("Example.User")).toBe("example.user")
  expect(usernameBase("💀")).toBe("exile")
})

async function signIn(
  t: ReturnType<typeof convexTest>,
  email: string,
  verified = true
) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("user", {
      name: "exile",
      email,
      emailVerified: verified,
      image: "https://cdn.discordapp.com/embed/avatars/0.png",
      createdAt: now,
      updatedAt: now,
    })
    const sessionId = await ctx.db.insert("session", {
      userId,
      token: crypto.randomUUID(),
      expiresAt: now + 86400000,
      createdAt: now,
      updatedAt: now,
    })
    return { userId, sessionId }
  })
  return t.withIdentity({ subject: userId, sessionId })
}

test("profile endpoints reject anonymous callers", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(api.profiles.me.functionRef, {})).rejects.toThrow(
    "Sign in"
  )
  await expect(
    t.mutation(api.profiles.complete.functionRef, {
      username: "exile",
      useDiscordAvatar: false,
    })
  ).rejects.toThrow("Sign in")
})

test("verified accounts confirm profiles, resolve collisions, and preserve avatar consent", async () => {
  const t = convexTest(schema, modules)
  const first = await signIn(t, "first@example.com")
  const second = await signIn(t, "second@example.com")
  expect(
    (await first.query(api.profiles.me.functionRef, {})).suggestedUsername
  ).toBe("exile")
  await first.mutation(api.profiles.complete.functionRef, {
    username: "Exile",
    useDiscordAvatar: false,
  })
  expect((await first.query(api.profiles.me.functionRef, {})).profile).toEqual({
    username: "exile",
    avatar: null,
  })
  expect(
    (await second.query(api.profiles.me.functionRef, {})).suggestedUsername
  ).toBe("exile_1")
  await expect(
    second.mutation(api.profiles.complete.functionRef, {
      username: "exile",
      useDiscordAvatar: true,
    })
  ).rejects.toThrow("taken")
  await second.mutation(api.profiles.complete.functionRef, {
    username: "exile_1",
    useDiscordAvatar: true,
  })
  expect(
    (await second.query(api.profiles.me.functionRef, {})).profile?.avatar
  ).toMatch(/^https:\/\/cdn.discordapp.com/)
  await first.mutation(api.profiles.complete.functionRef, {
    username: "changed",
    useDiscordAvatar: true,
  })
  expect(
    (await first.query(api.profiles.me.functionRef, {})).profile?.username
  ).toBe("exile")
})

test("unverified stored users cannot create profiles", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "unverified@example.com", false)
  await expect(
    user.mutation(api.profiles.complete.functionRef, {
      username: "exile",
      useDiscordAvatar: false,
    })
  ).rejects.toThrow("verified")
})

test("the actual Discord provider rejects invalid email before returning account data", async () => {
  const { default: definition } = await import("./functions/auth")
  const config = definition({} as never)
  expect(config.emailAndPassword.enabled).toBe(false)
  expect(config.account.accountLinking.enabled).toBe(false)
  expect(Object.keys(config.socialProviders)).toEqual(["discord"])
  for (const email of [null, "user@example.com"]) {
    for (const verified of [false, true]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            id: "123456789012345678",
            username: "actual_username",
            global_name: "exile",
            discriminator: "0",
            avatar: null,
            email,
            verified,
          })
        )
      )
      try {
        const result = await config.socialProviders.discord.getUserInfo({
          accessToken: "test",
        })
        if (email && verified) {
          expect(result?.user).toMatchObject({
            email,
            emailVerified: true,
            name: "actual_username",
          })
        } else expect(result).toBeNull()
      } finally {
        vi.unstubAllGlobals()
      }
    }
  }
})

test("HTTP auth routes expose only Discord and request identify plus email", async () => {
  vi.stubEnv("DISCORD_CLIENT_ID", "test-client-id")
  vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret")
  const t = convexTest(schema, modules)
  const response = await t.fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      provider: "discord",
      callbackURL: "http://localhost:3000/auth",
    }),
  })
  expect(response.status).toBe(200)
  const { url } = await response.json()
  const destination = new URL(url)
  expect(destination.hostname).toBe("discord.com")
  expect(destination.searchParams.get("scope")?.split(" ")).toEqual(
    expect.arrayContaining(["identify", "email"])
  )
  expect(destination.searchParams.get("redirect_uri")).toBe(
    "http://localhost:3000/api/auth/callback/discord"
  )
  expect(destination.searchParams.get("state")).toBeTruthy()
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
  let discordVerified = true
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input))
      if (url.includes("/oauth2/token"))
        return Response.json({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "identify email",
        })
      if (url.includes("/users/@me"))
        return Response.json({
          id: "123456789012345678",
          username: "discord_username",
          global_name: "Display name",
          discriminator: "0",
          avatar: null,
          email: "oauth@example.com",
          verified: discordVerified,
        })
      throw new Error(`Unexpected external request: ${url}`)
    })
  )
  try {
    const callback = await t.fetch(
      `/api/auth/callback/discord?code=test-code&state=${destination.searchParams.get("state")}`,
      { headers: { Cookie: cookies } }
    )
    expect(callback.status).toBe(302)
    expect(callback.headers.get("location")).toBe("http://localhost:3000/auth")
    const user = await t.run((ctx) => ctx.db.query("user").first())
    expect(user).toMatchObject({
      name: "discord_username",
      emailVerified: true,
    })
    expect(user?.image).toMatch(/^https:\/\/cdn.discordapp.com/)
    // A returning account must pass Discord verification again; its stored
    // verified flag must not bypass the upstream check.
    discordVerified = false
    const retry = await t.fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        provider: "discord",
        callbackURL: "http://localhost:3000/auth",
        errorCallbackURL: "http://localhost:3000/auth",
      }),
    })
    const retryUrl = new URL((await retry.json()).url)
    const retryCookies = retry.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ")
    const rejected = await t.fetch(
      `/api/auth/callback/discord?code=retry&state=${retryUrl.searchParams.get("state")}`,
      { headers: { Cookie: retryCookies } }
    )
    expect(rejected.headers.get("location")).toContain(
      "error=unable_to_get_user_info"
    )
    expect(await t.run((ctx) => ctx.db.query("session").take(10))).toHaveLength(
      1
    )
  } finally {
    vi.unstubAllGlobals()
  }
  const update = await t.fetch("/api/auth/update-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "spoofed" }),
  })
  expect(update.status).toBe(404)
  const password = await t.fetch("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      name: "No",
      email: "no@example.com",
      password: "password123456",
    }),
  })
  expect(password.status).toBeGreaterThanOrEqual(400)
})
