# Development and deployment

## Targets

Project: exile.sh (Convex slug `exile-sh`, team `nate-dunn`). Development: `next-axolotl-199`. Production: `brilliant-rooster-193`. Public source: `natedunn/exile.sh`. Contact: `hello@natedunn.net`.

Production has not been deployed by this implementation. Confirm the target before any Convex command. Never copy development deployment keys into Cloudflare production settings.

## Data collection

The hourly cron runs at minute 5 and exits unless the Convex server environment variable `COLLECTOR_ENABLED=true`. `GGG_CONTACT` defaults to the project contact. Neither belongs in a `VITE_` variable. The separate cleanup cron runs at minute 35, deleting up to 200 expired item-day buckets and 24 expired completion records per execution. Price history and completion records retain 92 full UTC days plus the current partial day. Raw source archives retain eight days; a separate 24-record batch clears old archive files while keeping their completion records, using an `archive-cleanup` checkpoint in the collector table. A cleanup backlog can temporarily retain more.

A bounded manual import does not require enabling the continuous collector:

```sh
bunx convex run ingestion:ingest '{"hour":<COMPLETED_UTC_HOUR_UNIX_SECONDS>,"remaining":30}'
```

Replace the placeholder with an integer divisible by 3600, no more than eight days old. `remaining` is capped at 48. One hour is processed per action; following hours are scheduled with rate-limit delays. Inspect `store:state` and the imports table to confirm the whole chain completed; the first command returning success only confirms the first hour.

```sh
bunx convex run store:state '{}'
```

Five consecutive failures open a circuit. Inspect `lastError` and Convex logs before running `store:resetCircuit`. Fix the cause before resuming the same hour. Source payloads are gzipped in Convex storage and SHA-256 hashed. A partially processed hour replays its archive and skips committed chunks. Completed item history is gated by the import ledger; current snapshots publish transactionally. Out-of-order imports cannot regress the current snapshot.

The cursor advances monotonically. Cron collection resumes at that cursor, one hour per invocation. A multi-hour outage requires a bounded catch-up, and a cursor older than eight days requires operator review and an explicit recent-hour import. Inspect that the desired league is in `shared/economy.ts` when a new league launches.

Current price documents and pair chunks are separate: each pair chunk holds at most 250 pairs. A publication safety bound stops collection if a league reaches 8,000 recent item-day records; split publication/read work before raising that bound. All ingestion, retention, and state changes are internal Convex functions. Public functions only read economic data.

## Free-tier review

The initial 30-hour development import produced 3,188 item-day records (~1.54 MB of serialized JSON) and read 82.9 MB of uncompressed upstream payloads. These are measured application sizes, **not billable-usage numbers**. The busiest combined snapshot reached ~803 KB, prompting separation into bounded pair chunks; the busiest price-only snapshot then measured ~383 KB.

Database bandwidth is the main concern: publication currently reads each league’s recent history and overview subscribers receive a full latest snapshot. Do not extrapolate storage size alone into a promise that continuous collection or public traffic is free. Check Convex’s dashboard usage, including action I/O, database bandwidth, storage, and function calls. Free allowances can change. No paid resources or overages were enabled.

Before enabling continuous production ingestion: measure a representative day, optimize publication reads (incremental rolling aggregates/per-league work), set budget alerts in the account, and verify the free-plan behavior at its cap. Development remains paused while this is unresolved. The 92-day price-history policy supports rolling 30/90-day rankings as data accumulates; it does not restore expired or uncollected hours. Raw archives still expire after eight days. Measure retained bucket storage and query reads before enabling continuous collection; daily rollups remain a future optimization.

## Cloudflare managed Git builds

Create a **Worker** through Cloudflare’s Git integration and select `natedunn/exile.sh`. Use `main` for production and an appropriate feature/preview branch for development. Do not connect automatic production builds until production Convex functions and configuration have been reviewed and deployed.

Configure Bun 1.3.9 / Node 24, repository root, build command `bun install --frozen-lockfile && bun run build`, and deployment command `bunx wrangler deploy`. The Cloudflare Vite plugin writes the server bundle/config and Wrangler redirect used by deployment. `wrangler.jsonc` names the Worker `exile-sh` and uses the TanStack Start server entry with `nodejs_compat`.

Build-time public environment variables:

| Variable               | Production value                             |
| ---------------------- | -------------------------------------------- |
| `VITE_CONVEX_URL`      | `https://brilliant-rooster-193.convex.cloud` |
| `VITE_CONVEX_SITE_URL` | `https://brilliant-rooster-193.convex.site`  |
| `VITE_SITE_URL`        | The chosen public origin                     |

Preview builds must use the development Convex URLs. These `VITE_` values are public, bundled configuration. Do not put secrets in them. Cloudflare does not need a Convex deploy key for a frontend-only build: generated bindings are committed. Deploy the backend separately after approval of the concrete production change.

Run `bun run build` and `bunx wrangler deploy --dry-run --config dist/server/wrangler.json` locally to validate the artifact without publishing. Attach the domain in Cloudflare after ownership/DNS is confirmed. No domain purchase or DNS changes are part of this implementation.

## Movers periods

The public `economy:movers` query accepts `24h`, `48h`, `7d`, `30d`, or `90d` and returns quote-specific changes and eligibility. The UI displays up to 50 entries per direction. Month labels mean rolling 30/90 days. The 24-hour view uses the published snapshot; other periods read only the latest 24-hour activity and the three-hour historical comparison window, checking the completion ledger. Reads are capped at 3,500 day buckets per window and reject that safety bound rather than silently truncating rankings. Unavailable comparison history returns an explicit empty state. Sparkline context stays at 48 hours.
