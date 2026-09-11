import { z } from "zod"
import { eq } from "kitcn/orm"
import { CRPCError } from "kitcn/server"
import { privateMutation } from "../lib/crpc"
import { buildLimits } from "./schema"

export const reserveImport = privateMutation
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    const window = Math.floor(Date.now() / 60_000)
    const limit = await ctx.orm.query.buildLimits.findFirst({
      where: { key: "import" },
    })
    const count = limit?.window === window ? limit.count : 0
    if (count >= 10)
      throw new CRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Imports are busy. Paste your export code instead, or try again in a minute.",
      })
    if (limit)
      await ctx.orm
        .update(buildLimits)
        .set({ window, count: count + 1 })
        .where(eq(buildLimits.key, "import"))
    else
      await ctx.orm
        .insert(buildLimits)
        .values({ key: "import", window, count: 1 })
  })
