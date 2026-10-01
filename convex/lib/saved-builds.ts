import { CRPCError } from "kitcn/server"
import { savedBuilds } from "../functions/schema"
import type { MutationCtx } from "../functions/generated/server"
import { buildSkill } from "../../shared/pob"
import type { BuildSnapshot } from "../../shared/pob"

export const SAVED_BUILD_LIMIT = 500

export async function saveBuildBookmark(
  ctx: MutationCtx,
  userId: string,
  build: { slug: string; title: string; snapshot: BuildSnapshot }
) {
  const existing = await ctx.orm.query.savedBuilds.findFirst({
    where: { userId, slug: build.slug },
  })
  if (existing) return
  const saved = await ctx.orm.query.savedBuilds.findMany({
    where: { userId },
    columns: { id: true },
    limit: SAVED_BUILD_LIMIT,
  })
  if (saved.length >= SAVED_BUILD_LIMIT)
    throw new CRPCError({
      code: "BAD_REQUEST",
      message: "Your saved bins are full. Remove a bin before saving another.",
    })
  await ctx.orm.insert(savedBuilds).values({
    userId,
    slug: build.slug,
    title: build.title,
    character: build.snapshot.ascendancy || build.snapshot.className,
    level: build.snapshot.level,
    skill: buildSkill(build.snapshot),
    savedAt: Date.now(),
  })
}
