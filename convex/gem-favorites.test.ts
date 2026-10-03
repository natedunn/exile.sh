/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
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

const { list, set, merge } = api.gemFavorites
const ARC = "Metadata/Items/Gems/SkillGemArc"
const SPARK = "Metadata/Items/Gems/SkillGemSpark"
const PIERCE = "Metadata/Items/Gems/SupportGemPierce"

test("gem favorite endpoints reject anonymous callers", async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(list.functionRef, {})).rejects.toThrow("Sign in")
  await expect(
    t.mutation(set.functionRef, { item: ARC, watched: true })
  ).rejects.toThrow("Sign in")
  await expect(t.mutation(merge.functionRef, { items: [ARC] })).rejects.toThrow(
    "Sign in"
  )
})

test("gem favorites wait until the account is confirmed", async () => {
  const t = convexTest(schema, modules)
  const pending = await signIn(t, "pending@example.com", false)
  await expect(pending.query(list.functionRef, {})).rejects.toThrow(
    "Create your exile.sh account"
  )
})

test("gem favorites are idempotent and private to each account", async () => {
  const t = convexTest(schema, modules)
  const first = await signIn(t, "first@example.com")
  const second = await signIn(t, "second@example.com")
  await first.mutation(set.functionRef, { item: ARC, watched: true })
  await first.mutation(set.functionRef, { item: ARC, watched: true })
  await first.mutation(set.functionRef, { item: PIERCE, watched: true })
  expect((await first.query(list.functionRef, {})).sort()).toEqual([
    ARC,
    PIERCE,
  ])
  expect(await second.query(list.functionRef, {})).toEqual([])
  await first.mutation(set.functionRef, { item: ARC, watched: false })
  await first.mutation(set.functionRef, { item: ARC, watched: false })
  expect(await first.query(list.functionRef, {})).toEqual([PIERCE])
})

test("merging browser gem favorites adds only what the account lacks", async () => {
  const t = convexTest(schema, modules)
  const user = await signIn(t, "merge@example.com")
  await user.mutation(set.functionRef, { item: ARC, watched: true })
  expect(
    await user.mutation(merge.functionRef, {
      items: [ARC, SPARK, SPARK, PIERCE],
    })
  ).toEqual({ added: 2 })
  expect((await user.query(list.functionRef, {})).sort()).toEqual(
    [ARC, SPARK, PIERCE].sort()
  )
})
