import {
  convexTable,
  defineSchema,
  index,
  integer,
  json,
  text,
} from "kitcn/orm"
import type { BuildSnapshot } from "../../shared/pob"
import type { ItemRow, Pair, Point } from "../../shared/economy"

export const history = convexTable(
  "history",
  {
    league: text().notNull(),
    item: text().notNull(),
    day: integer().notNull(),
    points: json<Point[]>().notNull(),
  },
  (t) => [
    index("item_day").on(t.league, t.item, t.day),
    index("league_day").on(t.league, t.day),
    index("day").on(t.day),
  ]
)

export const snapshots = convexTable(
  "snapshots",
  {
    league: text().notNull(),
    hour: integer().notNull(),
    prices: json<ItemRow[]>().notNull(),
    pairs: json<Pair[]>().notNull(),
    method: text().notNull(),
  },
  (t) => [index("league_hour").on(t.league, t.hour), index("hour").on(t.hour)]
)

export const pairSnapshots = convexTable(
  "pairSnapshots",
  {
    league: text().notNull(),
    hour: integer().notNull(),
    chunk: integer().notNull(),
    pairs: json<Pair[]>().notNull(),
  },
  (t) => [index("league_hour_chunk").on(t.league, t.hour, t.chunk)]
)

export const imports = convexTable(
  "imports",
  {
    hour: integer().notNull(),
    status: text().notNull(),
    hash: text().notNull(),
    archive: text().notNull(),
    marketCount: integer().notNull(),
    bytes: integer().notNull(),
    completedChunks: json<number[]>().notNull(),
    expectedChunks: integer().notNull(),
  },
  (t) => [index("hour").on(t.hour)]
)

export const collector = convexTable(
  "collector",
  {
    key: text().notNull(),
    leaseUntil: integer().notNull(),
    leaseToken: text().notNull(),
    nextAllowedAt: integer().notNull(),
    failures: integer().notNull(),
    lastError: text().notNull(),
    cursor: integer().notNull(),
  },
  (t) => [index("key").on(t.key)]
)

export const builds = convexTable(
  "builds",
  {
    slug: text().notNull(),
    title: text().notNull(),
    code: text().notNull(),
    snapshot: json<BuildSnapshot>().notNull(),
  },
  (t) => [index("slug").on(t.slug)]
)

export const buildLimits = convexTable(
  "buildLimits",
  {
    key: text().notNull(),
    window: integer().notNull(),
    count: integer().notNull(),
  },
  (t) => [index("key").on(t.key)]
)

export const xPosts = convexTable(
  "xPosts",
  {
    postId: text().notNull(),
    accountId: text().notNull(),
    body: text().notNull(),
    publishedAt: integer().notNull(),
    originalUrl: text().notNull(),
    editIds: json<string[]>().notNull(),
    hidden: integer().notNull(),
    fetchedAt: integer().notNull(),
  },
  (t) => [
    index("by_postId").on(t.postId),
    index("by_hidden_publishedAt").on(t.hidden, t.publishedAt),
  ]
)

export const xSync = convexTable(
  "xSync",
  {
    key: text().notNull(),
    accountId: text().notNull(),
    newestId: text().notNull(),
    pendingNewestId: text().notNull(),
    paginationToken: text().notNull(),
    nextPollAt: integer().notNull(),
    activeUntil: integer().notNull(),
    leaseUntil: integer().notNull(),
    leaseToken: text().notNull(),
    failures: integer().notNull(),
    lastError: text().notNull(),
    lastSuccessAt: integer().notNull(),
  },
  (t) => [index("by_key").on(t.key)]
)

export const patchThreads = convexTable(
  "patchThreads",
  {
    threadId: text().notNull(),
    title: text().notNull(),
    publishedAt: integer().notNull(),
    nextFetchAt: integer().notNull(),
    leaseToken: text().notNull(),
    lastError: text().notNull(),
    fetchedAt: integer().notNull(),
  },
  (t) => [
    index("by_threadId").on(t.threadId),
    index("by_publishedAt").on(t.publishedAt),
  ]
)

export const patchBodies = convexTable(
  "patchBodies",
  {
    threadId: text().notNull(),
    title: text().notNull(),
    html: text().notNull(),
  },
  (t) => [index("by_threadId").on(t.threadId)]
)

export const tables = {
  patchThreads,
  patchBodies,
  xPosts,
  xSync,
  history,
  snapshots,
  pairSnapshots,
  imports,
  collector,
  builds,
  buildLimits,
}
// Explicit synchronous mutations keep hour publication and checkpoints atomic.
export default defineSchema(tables, {
  defaults: { mutationExecutionMode: "sync" },
})
