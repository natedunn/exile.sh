# Development and deployment

## Targets

Project: exile.sh (Convex slug `exile-sh`, team `nate-dunn`). Development: `next-axolotl-199`. Production: `brilliant-rooster-193`. Public source: `natedunn/exile.sh`. Contact: `hello@natedunn.net`.

The managed build deploys production Convex before Cloudflare publishes the Worker. Confirm the target before any manual Convex command. Never copy development deployment keys into Cloudflare production settings.

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

The cursor advances monotonically. On first automatic startup, collection begins 30 completed hours back. Cron collection resumes at the saved cursor and schedules up to 48 hours per invocation, respecting rate limits. Automatic continuations and retries recheck COLLECTOR_ENABLED, so pausing also stops queued work. Larger backlogs drain over subsequent hourly invocations. If the cursor is older than eight days, automatic collection resumes at the earliest supported hour and emits a history-gap log with the omitted interval. Missing older history remains missing. Each successful import logs its source hour and processing duration. Inspect that the desired league is in `shared/economy.ts` when a new league launches.

Current price documents and pair chunks are separate: each pair chunk holds at most 250 pairs. A publication safety bound stops collection if a league reaches 8,000 recent item-day records; split publication/read work before raising that bound. All ingestion, retention, and state changes are internal Convex functions. Public functions only read economic data.

## Free-tier review

The initial 30-hour development import produced 3,188 item-day records (~1.54 MB of serialized JSON) and read 82.9 MB of uncompressed upstream payloads. These are measured application sizes, **not billable-usage numbers**. The busiest combined snapshot reached ~803 KB, prompting separation into bounded pair chunks; the busiest price-only snapshot then measured ~383 KB.

Database bandwidth is the main concern: publication currently reads each league’s recent history and overview subscribers receive a full latest snapshot. Do not extrapolate storage size alone into a promise that continuous collection or public traffic is free. Check Convex’s dashboard usage, including action I/O, database bandwidth, storage, and function calls. Free allowances can change. No paid resources or overages were enabled.

The managed production build enables collection on first initialization. Monitor the first 24 hours in the Convex usage dashboard; no paid plan or overage setting is changed by the scripts. Pause with COLLECTOR_ENABLED=false if usage is too high. Publication read optimization (incremental rolling aggregates/per-league work) remains follow-up work. Development collection remains independently paused. The 92-day price-history policy supports rolling 30/90-day rankings as data accumulates; it does not restore expired or uncollected hours. Raw archives still expire after eight days. Measure retained bucket storage and query reads as history grows; daily rollups remain a future optimization.

## Cloudflare managed Git builds

This uses the same two-stage pattern as `natedunn/kino`. Cloudflare runs the scripts; there is no GitHub Actions deployment pipeline. Production targets the fixed production deployment. Every non-production branch gets a reusable, isolated Convex preview deployment and a matching aliased Worker preview URL.

In the `exile-sh` Worker's **Settings → Build**, configure:

| Setting                                   | Value                                                       |
| ----------------------------------------- | ----------------------------------------------------------- |
| Production branch                         | `main`                                                      |
| Root directory                            | `/`                                                         |
| Build command                             | `bun install --frozen-lockfile && bun run build:cloudflare` |
| Deploy command                            | `bun run deploy`                                            |
| Version command (non-production branches) | `bun run deploy:preview`                                    |

Add these **build** variables and secrets:

| Name                        | Type       | Value                                                                                     |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `BUN_VERSION`               | Plain text | `1.3.9`                                                                                   |
| `NODE_VERSION`              | Plain text | `24`                                                                                      |
| `CONVEX_PROD_DEPLOY_KEY`    | Secret     | Production deploy key from Convex → `brilliant-rooster-193` → Settings → URL & Deploy Key |
| `CONVEX_PREVIEW_DEPLOY_KEY` | Secret     | Project preview deploy key from Convex → project Settings → Generate Preview Deploy Key   |

Do not paste either key into chat or put one in a `VITE_` variable. Use a deployment-scoped production key for production and the project-scoped preview key for branch builds. The script verifies both key prefixes and fails before running commands if one is wrong. `WORKERS_CI_BRANCH` is supplied by Cloudflare; the script requires it and never guesses production from a local checkout.

The existing `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, and `VITE_SITE_URL` dashboard variables can be removed: Convex injects the selected deployment URL into the nested Vite build, and the script derives the matching site URL. Main uses production (`brilliant-rooster-193`) and `https://exile.sh`. Other branches deploy to `preview/<readable-prefix>-<branch-hash>` and never start collectors. The Worker upload uses the same collision-resistant name as its preview alias. Optional `VITE_SITE_URL_PREVIEW` overrides the inferred `https://<preview-name>-exile-sh.hello-fc8.workers.dev` origin.

### What a production build does

1. Validate the branch and production key. `kitcn deploy` delegates its `--cmd` to Convex, which builds the frontend against the selected production URL before Convex pushes functions/schema. Deployment credentials are removed from the frontend build subprocess environment.
2. After the push, kitcn runs its migration and aggregate-backfill hooks. The Cloudflare release stops on any build, deploy, migration, or backfill failure.
3. Set `COLLECTOR_ENABLED=true` only if the variable is absent. An existing `false` remains paused, including after redeployment. `GGG_CONTACT` defaults server-side to `hello@natedunn.net`.
4. If enabled, call the internal collector once immediately. It imports the first hour and queues the rest of its bounded batch in Convex. A source/import error fails this build; transient retries may still be queued in Convex. Inspect logs before retrying. A successful build is not proof the whole backfill is finished.
5. Cloudflare's deploy phase runs Wrangler against `dist/server/wrangler.json` to publish the frontend.

For a non-production branch, the build instead reuses or creates the branch's Convex preview deployment, runs migrations and aggregate backfills there, builds against that deployment URL, and uploads a Worker version with the same branch alias. On first creation, the preview receives the same small synthetic economy seed used by anonymous worktrees. It does not inherit production/development data, store raw archives, or enable collection.

The first run imports 30 hourly digests, enough for initial 24-hour changes; charts and longer comparisons fill in as data arrives. Watch the imports ledger and `ingestion-complete` logs for progress. Empty league markets can legitimately publish no price rows. Five consecutive failures stop collection until the cause is fixed and the circuit is reset.

Once deployed, the hourly cron runs on Convex even while your computer is off and with no new commits. Check source freshness in the site footer and compare it with the last completed import. Neither Worker deployment nor a frontend rollback rolls back Convex: this is an ordered deployment, not an atomic cross-service transaction. Keep schema/API changes backward compatible with the previously deployed frontend.

### Local verification

`bun run build` remains frontend-only and never deploys Convex. Run `bun run test:deploy` for mocked orchestration tests (no credentials/network/writes), `bun run test` for collector and data tests, and `bun run typecheck` / `bun run lint`. `bun run dev` verifies backend changes against a worktree-local anonymous deployment, not the shared dev or production deployment. Do not run `build:cloudflare` locally with deploy keys merely to test it.

## Movers periods

The public `economy:movers` query accepts `24h`, `48h`, `7d`, `30d`, or `90d` and returns quote-specific changes and eligibility. The UI displays up to 50 entries per direction. Month labels mean rolling 30/90 days. The 24-hour view uses the published snapshot; other periods read only the latest 24-hour activity and the three-hour historical comparison window, checking the completion ledger. Reads are capped at 3,500 day buckets per window and reject that safety bound rather than silently truncating rankings. Unavailable comparison history returns an explicit empty state. Sparkline context stays at 48 hours.

## Freshness banner

The UI checks freshness once per minute. A source timestamp marks the start of a completed hour: the 20:00 digest covers 20:00–21:00, and its replacement is scheduled for 22:05. The banner stays hidden through 22:35, giving collection a 30-minute grace period after that next scheduled refresh. The same UTC calculation applies across midnight. A newer snapshot clears the warning automatically. The banner describes delayed data, not a diagnosed collector failure; an initial historical backfill can legitimately trigger it until caught up.

## X sidebar storage and polling

The sidebar reads the latest five visible posts from Convex's `xPosts` table.
Page requests never call X. Posts remain in the database, including older posts
that are no longer in the sidebar. Each record stores the original post ID, text,
publication time, original URL, account ID, edit history IDs, and import time.

Enable collection on **one Convex deployment** with these backend variables:

- `X_BEARER_TOKEN`: the X app's bearer token (a Convex secret, not a `VITE_` variable).
- `X_POLL_ENABLED=true`: explicit opt-in; unset or `false` pauses collection while
  keeping saved posts readable. Avoid enabling the same collector in every worktree.

For this worktree's local backend, set the token interactively and enable polling:

```sh
bunx convex env set X_BEARER_TOKEN --env-file .convex/anonymous.env
bunx convex env set X_POLL_ENABLED true --env-file .convex/anonymous.env
bunx convex run xIngestion:poll '{}' --env-file .convex/anonymous.env
```

Production needs these variables configured on its Convex deployment as well.
The old Worker-side X token is no longer read by the sidebar. Local `.env.local`
values are not automatically synchronized to Convex; update the backend secret
when rotating the token.

The cron checks every 15 minutes, but the saved `xSync.nextPollAt` controls whether
it makes an X request. Normal polling is hourly. A post published within the last
24 hours enables 15-minute polling until that activity window expires. The first
import fetches at most 20 recent posts. Later imports use `since_id` and request
only newer posts; the account ID is resolved once and persisted.

Pagination checkpoints and post writes commit together. The newest-ID cursor is
advanced only after all pages finish. A poll processes at most three pages of 100
posts, then continues on a subsequent tick. A lease prevents overlapping polls;
expired leases can be recovered. Failures preserve saved posts and use exponential
backoff from 15 minutes up to 24 hours, respecting bounded upstream retry hints.
Inspect `xStore:state` for the next poll, cursor, pagination checkpoint, and last
error. No page visit can force a paid refresh.

Newly imported edit revisions hide stored earlier revisions. To hide a removed
post administratively (or restore it), use the internal `xStore:hide` mutation:

```sh
bunx convex run xStore:hide '{"postId":"POST_ID","hidden":true}' --env-file .convex/anonymous.env
```

This importer does not routinely reread the archive or automatically discover
old deletions. Handle removal notices through the administrative path; add a
separate reconciliation process if broader edit/deletion tracking is needed.

### Patch note archive

Patch note page requests read `patchThreads` (index metadata) and `patchBodies`
(sanitized opening posts) from Convex. They never fetch the forum directly.
Deploy the Convex functions together with the frontend. No additional secrets
are required. Initialize a new deployment with `convex run patchIngestion:poll
'{}'` (using the appropriate deployment options); the hourly cron handles
subsequent discovery. The local worktree deployment has been initialized.

The importer discovers up to 100 threads from the official forum's first page
and schedules their imports two seconds apart. New posts are saved immediately;
posts less than seven days old are refreshed every six hours for corrections,
and older posts still on the forum index are refreshed weekly. Posts that leave
the index remain stored. This is an archive starting with the current index,
not a backfill of every historical forum page. The site displays the newest 100
saved threads; saved detail URLs remain readable after falling off this list.

Per-thread transactional leases prevent duplicate fetches. Failed imports retry
on the next hourly discovery and retain any previously saved body. Inspect
`patchThreads.lastError` and Convex action logs for failures. Forum index failures
also leave the saved index intact. Source responses are bounded at 4 MB and
sanitized bodies at 900 KB to stay below Convex's document size limit; oversized
posts produce a recorded error rather than truncated notes. The parser supports
both ordinary forum opening posts and GGG's featured `newsPost` layout (including
thread 4000864), preserving formatted text and safe links while excluding replies,
scripts, and inline styles.
