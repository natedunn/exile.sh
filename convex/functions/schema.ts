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

export const tables = {
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
