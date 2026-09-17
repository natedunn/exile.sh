import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { authMutation, authQuery } from "../lib/crpc"
import { usernameBase } from "../lib/discord-profile"
import { profiles } from "./schema"
import type { QueryCtx } from "./generated/server"

async function availableUsername(ctx: QueryCtx, name: string) {
  const base = usernameBase(name)
  for (let attempt = 0; attempt < 32; attempt++) {
    // Deterministic candidates are safe in queries; the mutation rechecks the
    // indexed range atomically, so competing signups cannot claim the same name.
    const candidate = attempt === 0 ? base : `${base}_${attempt}`
    if (
      !(await ctx.orm.query.profiles.findFirst({
        where: { username: candidate },
      }))
    )
      return candidate
  }
  throw new CRPCError({
    code: "CONFLICT",
    message: "That username is busy. Choose another username.",
  })
}

export const me = authQuery.query(async ({ ctx }) => {
  const profile = await ctx.orm.query.profiles.findFirst({
    where: { userId: ctx.userId },
  })
  return {
    profile: profile
      ? { username: profile.username, avatar: profile.avatar }
      : null,
    suggestedUsername:
      profile?.username ??
      (await availableUsername(ctx, ctx.user.name)),
    discordAvatar: ctx.user.image || null,
  }
})

export const complete = authMutation
  .input(
    z.object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(30)
        .regex(/^[a-z0-9_.]+$/),
      useDiscordAvatar: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.profiles.findFirst({
      where: { userId: ctx.userId },
    })
    if (existing) return { username: existing.username }
    // Never silently change the username the user just confirmed. Return a new
    // suggestion if another signup claimed it while their form was open.
    const taken = await ctx.orm.query.profiles.findFirst({
      where: { username: input.username },
    })
    if (taken)
      throw new CRPCError({
        code: "CONFLICT",
        message: `That username was just taken. Try ${await availableUsername(ctx, input.username)}.`,
      })
    await ctx.orm.insert(profiles).values({
      userId: ctx.userId,
      username: input.username,
      avatar: input.useDiscordAvatar ? ctx.user.image || null : null,
    })
    return { username: input.username }
  })
