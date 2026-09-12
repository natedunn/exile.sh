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
};

export declare const components: {};
