/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  builds: {
    create: FunctionReference<
      "mutation",
      "public",
      { code: string; slug: string; title: string },
      any
    >;
    get: FunctionReference<"query", "public", { slug: string }, any>;
    resolve: FunctionReference<"action", "public", { url: string }, string>;
  };
  economy: {
    itemHistory: FunctionReference<
      "query",
      "public",
      {
        days: 1 | 7 | 30 | 90;
        item: string;
        league:
          "Forbidden Rites" | "HC Forbidden Rites" | "Standard" | "Hardcore";
        quote: "Exalted" | "Chaos" | "Divine";
      },
      {
        completedThrough: number | null;
        points: Array<Array<number | number | number | number>>;
      }
    >;
    movers: FunctionReference<
      "query",
      "public",
      {
        league:
          "Forbidden Rites" | "HC Forbidden Rites" | "Standard" | "Hardcore";
        period: "24h" | "48h" | "7d" | "30d" | "90d";
      },
      {
        hasComparison: boolean;
        hour: number;
        period: "24h" | "48h" | "7d" | "30d" | "90d";
        rows: Array<{
          changes: Array<number | null>;
          eligible: Array<boolean>;
          id: string;
        }>;
      } | null
    >;
    overview: FunctionReference<
      "query",
      "public",
      {
        league:
          "Forbidden Rites" | "HC Forbidden Rites" | "Standard" | "Hardcore";
      },
      {
        hour: number;
        league: string;
        method: string;
        pairs: Array<{
          a: string;
          b: string;
          id: string;
          sa: number;
          sb: number;
          va: number;
          vb: number;
        }>;
        prices: Array<{
          changes: Array<number | null>;
          changes7: Array<number | null>;
          direct: boolean;
          eligible: Array<boolean>;
          id: string;
          price: number;
          trends: Array<Array<number | null>>;
          volume: number;
        }>;
      } | null
    >;
  };
  patchStore: {
    latest: FunctionReference<"query", "public", {}, any>;
    post: FunctionReference<"query", "public", { threadId: string }, any>;
  };
  profiles: {
    complete: FunctionReference<
      "mutation",
      "public",
      { useDiscordAvatar: boolean; username: string },
      any
    >;
    me: FunctionReference<"query", "public", {}, any>;
  };
  xStore: {
    latest: FunctionReference<"query", "public", {}, any>;
  };
};

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: {
  buildImportBudget: {
    reserveImport: FunctionReference<"mutation", "internal", {}, any>;
  };
  generated: {
    aggregate: {
      aggregateBackfill: FunctionReference<"mutation", "internal", any, any>;
      aggregateBackfillChunk: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
      aggregateBackfillStatus: FunctionReference<"query", "internal", any, any>;
    };
    auth: {
      consumeOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; where?: Array<any> } },
        any
      >;
      count: FunctionReference<
        "query",
        "internal",
        {
          model: string;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              string | number | boolean | Array<string> | Array<number> | null;
          }>;
        },
        any
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        { input: { data: any; model: string }; select?: Array<string> },
        any
      >;
      deleteMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      deleteOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; where?: Array<any> } },
        any
      >;
      findMany: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          limit?: number;
          model: string;
          offset?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          select?: Array<string>;
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              string | number | boolean | Array<string> | Array<number> | null;
          }>;
        },
        any
      >;
      findOne: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          model: string;
          select?: Array<string>;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            mode?: "sensitive" | "insensitive";
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              string | number | boolean | Array<string> | Array<number> | null;
          }>;
        },
        any
      >;
      getLatestJwks: FunctionReference<"action", "internal", {}, any>;
      incrementOne: FunctionReference<
        "mutation",
        "internal",
        {
          input: {
            increment: Record<string, number>;
            model: string;
            set?: Record<string, any>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              mode?: "sensitive" | "insensitive";
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          };
        },
        any
      >;
      rotateKeys: FunctionReference<"action", "internal", {}, any>;
      updateMany: FunctionReference<
        "mutation",
        "internal",
        {
          input: { model: string; update: any; where?: Array<any> };
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      updateOne: FunctionReference<
        "mutation",
        "internal",
        { input: { model: string; update: any; where?: Array<any> } },
        any
      >;
    };
    server: {
      migrationCancel: FunctionReference<"mutation", "internal", any, any>;
      migrationRun: FunctionReference<"mutation", "internal", any, any>;
      migrationRunChunk: FunctionReference<"mutation", "internal", any, any>;
      migrationStatus: FunctionReference<"query", "internal", any, any>;
      reset: FunctionReference<"action", "internal", any, any>;
      resetChunk: FunctionReference<
        "mutation",
        "internal",
        { cursor: string | null; tableName: string },
        any
      >;
      scheduledDelete: FunctionReference<"mutation", "internal", any, any>;
      scheduledMutationBatch: FunctionReference<
        "mutation",
        "internal",
        any,
        any
      >;
    };
  };
  ingestion: {
    ingest: FunctionReference<
      "action",
      "internal",
      { hour?: number; remaining?: number },
      any
    >;
  };
  patchIngestion: {
    poll: FunctionReference<"action", "internal", {}, any>;
    post: FunctionReference<"action", "internal", { threadId: string }, any>;
  };
  patchStore: {
    acquire: FunctionReference<
      "mutation",
      "internal",
      { threadId: string; token: string },
      any
    >;
    discover: FunctionReference<
      "mutation",
      "internal",
      {
        items: Array<{ publishedAt: number; threadId: string; title: string }>;
      },
      any
    >;
    finish: FunctionReference<
      "mutation",
      "internal",
      {
        error: string;
        post?: { html: string; title: string };
        threadId: string;
        token: string;
      },
      any
    >;
  };
  seed: {
    local: FunctionReference<"mutation", "internal", { now?: number }, any>;
  };
  store: {
    acquire: FunctionReference<
      "mutation",
      "internal",
      { hour: number; token: string },
      any
    >;
    begin: FunctionReference<
      "mutation",
      "internal",
      {
        archive: string;
        bytes: number;
        expectedChunks: number;
        hash: string;
        hour: number;
        marketCount: number;
      },
      any
    >;
    cleanup: FunctionReference<"mutation", "internal", {}, any>;
    imported: FunctionReference<"query", "internal", { hour: number }, any>;
    publish: FunctionReference<
      "mutation",
      "internal",
      {
        hour: number;
        leagues: Array<{
          league: string;
          pairs: Array<{
            a: string;
            b: string;
            id: string;
            sa: number;
            sb: number;
            va: number;
            vb: number;
          }>;
          prices: Array<{
            direct: boolean;
            id: string;
            price: number;
            volume: number;
          }>;
        }>;
      },
      any
    >;
    recent: FunctionReference<
      "query",
      "internal",
      { hour: number; league: string },
      any
    >;
    release: FunctionReference<
      "mutation",
      "internal",
      { cursor: number; error: string; nextAllowedAt: number; token: string },
      any
    >;
    resetCircuit: FunctionReference<"mutation", "internal", {}, any>;
    state: FunctionReference<"query", "internal", {}, any>;
    writeChunk: FunctionReference<
      "mutation",
      "internal",
      {
        chunk: number;
        hour: number;
        league: string;
        prices: Array<{
          direct: boolean;
          id: string;
          price: number;
          volume: number;
        }>;
      },
      any
    >;
  };
  xIngestion: {
    poll: FunctionReference<"action", "internal", {}, any>;
  };
  xStore: {
    acquire: FunctionReference<"mutation", "internal", { token: string }, any>;
    hide: FunctionReference<
      "mutation",
      "internal",
      { hidden: boolean; postId: string },
      any
    >;
    release: FunctionReference<
      "mutation",
      "internal",
      { error: string; retryAt?: number; token: string },
      any
    >;
    rememberAccount: FunctionReference<
      "mutation",
      "internal",
      { accountId: string; token: string },
      any
    >;
    savePage: FunctionReference<
      "mutation",
      "internal",
      {
        nextToken: string;
        posts: Array<{
          created_at: string;
          edit_history_tweet_ids?: Array<string>;
          id: string;
          text: string;
        }>;
        token: string;
      },
      any
    >;
    state: FunctionReference<"query", "internal", {}, any>;
  };
};

export declare const components: {};
