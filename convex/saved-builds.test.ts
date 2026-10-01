/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { readFileSync } from "node:fs"
import schema from "./functions/schema"
import { api } from "./shared/api"
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

async function signIn(
  t: ReturnType<typeof convexTest>,
  email: string,
  confirmed = true
) {
  const { userId, sessionId } = await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert("user", {
      name: "exile",
      email,
      emailVerified: true,
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
    if (confirmed)
      await ctx.db.insert("profiles", {
        userId,
        username: email.split("@")[0],
      })
    return { userId, sessionId }
  })
  return t.withIdentity({ subject: userId, sessionId })
}

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)

test("saved bins and publishing with a bookmark require authentication", async () => {
  const t = convexTest(schema, modules)
  const slug = crypto.randomUUID()
  await expect(t.query(api.savedBuilds.list.functionRef, {})).rejects.toThrow(
    "Sign in"
  )
  await expect(
    t.query(api.savedBuilds.status.functionRef, { slug })
  ).rejects.toThrow("Sign in")
  await expect(
    t.mutation(api.savedBuilds.set.functionRef, { slug, saved: true })
  ).rejects.toThrow("Sign in")
  await expect(
    t.mutation(api.builds.createSaved.functionRef, {
      slug,
      title: "Test",
      code,
    })
  ).rejects.toThrow("Sign in")
  expect(await t.query(api.builds.get.functionRef, { slug })).toBeNull()
})

test("bookmarks are private, idempotent and removal preserves the snapshot", async () => {
  const t = convexTest(schema, modules)
  const first = await signIn(t, "first@example.com")
  const second = await signIn(t, "second@example.com")
  const slug = crypto.randomUUID()
  await first.mutation(api.builds.createSaved.functionRef, {
    slug,
    title: "Frozen Shaman",
    code,
  })
  const snapshot = await t.query(api.builds.get.functionRef, { slug })
  expect(await first.query(api.savedBuilds.status.functionRef, { slug })).toBe(
    true
  )
  expect(await second.query(api.savedBuilds.status.functionRef, { slug })).toBe(
    false
  )
  expect(await second.query(api.savedBuilds.list.functionRef, {})).toEqual([])
  await first.mutation(api.savedBuilds.set.functionRef, { slug, saved: true })
  expect(await first.query(api.savedBuilds.list.functionRef, {})).toMatchObject(
    [{ slug, title: "Frozen Shaman", character: "Shaman" }]
  )
  await second.mutation(api.savedBuilds.set.functionRef, { slug, saved: false })
  expect(await first.query(api.savedBuilds.status.functionRef, { slug })).toBe(
    true
  )
  await second.mutation(api.savedBuilds.set.functionRef, { slug, saved: true })
  await first.mutation(api.savedBuilds.set.functionRef, { slug, saved: false })
  await first.mutation(api.savedBuilds.set.functionRef, { slug, saved: false })
  expect(await first.query(api.savedBuilds.list.functionRef, {})).toEqual([])
  expect(await second.query(api.savedBuilds.status.functionRef, { slug })).toBe(
    true
  )
  expect(await t.query(api.builds.get.functionRef, { slug })).toEqual(snapshot)
  await expect(
    first.mutation(api.savedBuilds.set.functionRef, {
      slug: crypto.randomUUID(),
      saved: true,
    })
  ).rejects.toThrow("Build not found")
})

test("full bookmark libraries roll back publishing", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "full@example.com")
  const slug = crypto.randomUUID()
  await t.run(async (ctx) => {
    const owner = await ctx.db.query("user").first()
    for (let i = 0; i < 500; i++)
      await ctx.db.insert("savedBuilds", {
        userId: owner!._id,
        slug: crypto.randomUUID(),
        title: "Bin",
        character: "Shaman",
        level: 1,
        skill: "Skill",
        savedAt: i,
      })
  })
  await expect(
    user.mutation(api.builds.createSaved.functionRef, {
      slug,
      title: "Overflow",
      code,
    })
  ).rejects.toThrow("saved bins are full")
  expect(await t.query(api.builds.get.functionRef, { slug })).toBeNull()
})
