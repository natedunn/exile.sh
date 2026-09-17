import {
  boolean,
  convexTable,
  defineSchema,
  index,
  integer,
  json,
  text,
  timestamp,
  uniqueIndex,
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

export const userTable = convexTable(
  "user",
  {
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    userId: text(),
  },
  (t) => [index("email_name").on(t.email, t.name), index("name").on(t.name)]
)

export const sessionTable = convexTable(
  "session",
  {
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => userTable.id),
  },
  (t) => [
    index("expiresAt").on(t.expiresAt),
    index("expiresAt_userId").on(t.expiresAt, t.userId),
    index("userId").on(t.userId),
  ]
)

export const accountTable = convexTable(
  "account",
  {
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => userTable.id),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
    issuer: text().notNull(),
  },
  (t) => [
    index("accountId").on(t.accountId),
    index("accountId_providerId").on(t.accountId, t.providerId),
    index("providerId_userId").on(t.providerId, t.userId),
    index("userId").on(t.userId),
    uniqueIndex("issuer_accountId").on(t.issuer, t.accountId),
  ]
)

export const verificationTable = convexTable(
  "verification",
  {
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull(),
    updatedAt: timestamp().notNull(),
  },
  (t) => [
    index("expiresAt").on(t.expiresAt),
    index("identifier").on(t.identifier),
  ]
)

export const jwksTable = convexTable("jwks", {
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp().notNull(),
  expiresAt: timestamp(),
  alg: text(),
  crv: text(),
})

// App-owned identity remains independent of OAuth providers and their tokens.
export const profiles = convexTable("profiles", {
  userId: text()
    .notNull()
    .unique()
    .references(() => userTable.id),
  username: text().notNull().unique(),
  avatar: text(),
})

export const tables = {
  profiles,
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
  user: userTable,
  session: sessionTable,
  account: accountTable,
  verification: verificationTable,
  jwks: jwksTable,
}
// Explicit synchronous mutations keep hour publication and checkpoints atomic.
export default defineSchema(tables, {
  defaults: { mutationExecutionMode: "sync" },
}).relations((r) => ({
  user: {
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
}))
