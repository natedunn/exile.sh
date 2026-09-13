import { z } from "zod"
import { env } from "./_generated/server"
import { privateAction } from "../lib/crpc"
import { createXStoreCaller } from "./generated/xStore.runtime"
import { X_ACCOUNT, xId, xTimeline } from "../../shared/x-sync"

export const poll = privateAction
  .input(z.object({}))
  .action(async ({ ctx }) => {
    if (env.X_POLL_ENABLED !== "true" || !env.X_BEARER_TOKEN)
      return { status: "paused" }
    const store = createXStoreCaller(ctx)
    const token = crypto.randomUUID()
    const state = await store.acquire({ token })
    if (!state) return { status: "not-due" }
    let retryAt = 0
    let failure = "X request failed"
    const read = async (url: string): Promise<unknown> => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) {
        failure = `X API returned ${response.status}`
        const retry = response.headers.get("retry-after")
        retryAt = retry
          ? /^\d+$/.test(retry)
            ? Date.now() + Number(retry) * 1000
            : Date.parse(retry)
          : 0
        const reset = Number(response.headers.get("x-rate-limit-reset")) * 1000
        if (Number.isFinite(reset))
          retryAt = Math.max(Number.isFinite(retryAt) ? retryAt : 0, reset)
        throw new Error(failure)
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Empty X response")
      const chunks: Uint8Array[] = []
      let length = 0
      let chunk = await reader.read()
      while (!chunk.done) {
        length += chunk.value.byteLength
        if (length > 2_000_000) {
          await reader.cancel()
          throw new Error("X response too large")
        }
        chunks.push(chunk.value)
        chunk = await reader.read()
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const part of chunks) {
        bytes.set(part, offset)
        offset += part.length
      }
      return JSON.parse(new TextDecoder().decode(bytes))
    }
    try {
      let accountId = state.accountId
      if (!accountId) {
        accountId = z
          .object({ data: z.object({ id: xId }) })
          .parse(
            await read(`https://api.x.com/2/users/by/username/${X_ACCOUNT}`)
          ).data.id
        if (!(await store.rememberAccount({ token, accountId })))
          return { status: "lease-lost" }
      }
      let paginationToken = state.paginationToken
      for (let page = 0; page < 3; page++) {
        const url = new URL(`https://api.x.com/2/users/${accountId}/tweets`)
        url.searchParams.set("max_results", state.newestId ? "100" : "20")
        url.searchParams.set("exclude", "replies,retweets")
        url.searchParams.set(
          "tweet.fields",
          "created_at,edit_history_tweet_ids"
        )
        if (state.newestId) url.searchParams.set("since_id", state.newestId)
        if (paginationToken)
          url.searchParams.set("pagination_token", paginationToken)
        const result = xTimeline.parse(await read(url.href))
        // Seed just the latest twenty once; incremental runs exhaust all new pages.
        paginationToken = state.newestId ? (result.meta.next_token ?? "") : ""
        if (
          !(await store.savePage({
            token,
            posts: result.data ?? [],
            nextToken: paginationToken,
          }))
        )
          return { status: "lease-lost" }
        if (!paginationToken) return { status: "complete" }
      }
      await store.release({ token, error: "" })
      return { status: "continuing" }
    } catch {
      // Only persist our own error label, never credentials or upstream bodies.
      await store.release({
        token,
        error: failure,
        ...(Number.isFinite(retryAt) && retryAt > 0 ? { retryAt } : {}),
      })
      return { status: "backoff" }
    }
  })
