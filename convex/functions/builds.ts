import { createBuildImportBudgetCaller } from "./generated/buildImportBudget.runtime"
import { eq } from "kitcn/orm"
import { z } from "zod"
import { CRPCError } from "kitcn/server"
import { publicAction, publicMutation, publicQuery } from "../lib/crpc"
import { builds, buildLimits } from "./schema"
import {
  MAX_CODE_LENGTH,
  normalizeCode,
  parseBuild,
  pobbinRawUrl,
} from "../../shared/pob"

const slug = z.string().uuid()
export const get = publicQuery
  .input(z.object({ slug }))
  .query(async ({ ctx, input }) => {
    const build = await ctx.orm.query.builds.findFirst({
      where: { slug: input.slug },
    })
    return build
      ? {
          slug: build.slug,
          title: build.title,
          code: build.code,
          snapshot: build.snapshot,
        }
      : null
  })
export const create = publicMutation
  .input(
    z.object({
      slug,
      title: z.string().trim().min(1).max(100),
      code: z.string().max(MAX_CODE_LENGTH * 2),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.orm.query.builds.findFirst({
      where: { slug: input.slug },
    })
    if (existing)
      throw new CRPCError({
        code: "CONFLICT",
        message: "This share link already exists. Please try again.",
      })
    // A global beta publishing budget is enforced in the same transaction as creation.
    const window = Math.floor(Date.now() / 60_000)
    const limit = await ctx.orm.query.buildLimits.findFirst({
      where: { key: "publish" },
    })
    const count = limit?.window === window ? limit.count : 0
    if (count >= 30)
      throw new CRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Build sharing is busy. Please try again in a minute.",
      })
    let snapshot
    let code
    try {
      code = normalizeCode(input.code)
      snapshot = parseBuild(code)
    } catch (error) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error ? error.message : "Invalid build export.",
      })
    }
    if (limit)
      await ctx.orm
        .update(buildLimits)
        .set({ window, count: count + 1 })
        .where(eq(buildLimits.key, "publish"))
    else
      await ctx.orm
        .insert(buildLimits)
        .values({ key: "publish", window, count: 1 })
    await ctx.orm
      .insert(builds)
      .values({ slug: input.slug, title: input.title, code, snapshot })
    return { slug: input.slug }
  })

export const resolve = publicAction
  .input(z.object({ url: z.string().max(300) }))
  .output(z.string())
  .action(async ({ ctx, input }) => {
    let url: string
    try {
      url = pobbinRawUrl(input.url)
    } catch {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Enter a valid pobb.in build link.",
      })
    }
    await createBuildImportBudgetCaller(ctx).reserveImport({})
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: "text/plain",
          "User-Agent":
            "exile.sh/0.1 (https://exile.sh; contact: https://github.com/natedunn/exile.sh/issues)",
        },
      })
      if (!response.ok || !response.body)
        throw new Error(
          "The build could not be fetched. It may be private, missing, or temporarily rate limited. Paste its export code instead."
        )
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let code = ""
      let bytes = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          code += decoder.decode(value, { stream: true })
          if (bytes > MAX_CODE_LENGTH)
            throw new Error("This export is too large.")
        }
      } finally {
        await reader.cancel()
      }
      code += decoder.decode()
      parseBuild(code)
      return normalizeCode(code)
    } catch (error) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "Import failed. Paste the export code instead.",
      })
    }
  })
