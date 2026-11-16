# Repository patch triage

`PoE2 patch triage` runs daily and can be dispatched manually. It complements the
website's Convex news ingestion; it does not add GitHub credentials to Convex.
It uses the same official PoE2 forum parser and bounded fetch helper.

## What happens

The first successful run creates a **closed checkpoint issue**, baselining the
currently visible posts without flooding the repository with historical alerts.
Keep that issue, even though it is closed. Subsequent runs compare opening-post
content, including edits. Each run revisits up to 100 discovered or previously
tracked posts. Old posts outside this rolling window are not monitored forever.

The watcher routes change descriptions across items/crafting, gems/supports,
character trees, augments/sockets, endgame/mechanics and economy/league metadata.
A change can affect multiple families. Unmapped change descriptions get a coverage
review section rather than being silently assumed irrelevant. Clearly operational
entries without game-system signals are skipped.

This is **heuristic triage, not a semantic impact analysis**. It can produce false
positives and miss prose that does not use recognized change wording. It cannot
establish upstream source compatibility or implement new mechanics. Read the full
notes when reviewing an issue. The issue contains evidence, candidate source and
consumer paths, concrete checks and the existing maintenance runbook. It does not
claim a rebuild is necessary merely because a patch exists.

A relevant patch gets one issue mentioning `@natedunn`. Repeated identical runs
are quiet. Closing the issue acknowledges that version; a changed gameplay entry
reopens the same issue. Operational-only edits do not notify again. Open **and
closed** issues and PRs containing the exact official post URL count as already
owned, so the watcher does not create competing work. Only records authored by the repository owner or GitHub Actions bot establish
coverage. A subsequently observed gameplay edit can create a new review issue
even when the original version was covered elsewhere.

## Safety and operations

- Uses the short-lived repository token with `contents: read`, `issues: write`.
  No PAT, external model API, production credentials, merge or deployment access.
- Scheduled runs serialize. State is stored in the closed issue, not an evictable
  Actions cache. A failed state write can be retried without duplicating issues.
- Notes are parsed as untrusted data; upstream text is not executed or used as
  shell commands. GitHub mentions/markup in source excerpts are neutralized.
- A failed poll/parser/API operation fails the run and attempts to create/reopen
  one reusable failure issue. Repeated failures keep the same issue; recovery
  closes it. If GitHub is unavailable or permission is denied, failure reporting
  cannot work; GitHub Actions failure notifications remain the fallback.
- No reference data is automatically regenerated, committed, merged or published.
  The existing source-readiness and mechanic-review gates require judgment. This
  workflow automates detection and triage, not those decisions.
- Dependencies are installed with lifecycle scripts disabled. PR validation runs
  core tests without a write token; scheduled/manual runs execute the watcher.

## Verification and rollout

```sh
node --test scripts/patch-watch-core.test.mjs
GITHUB_REPOSITORY=natedunn/exile.sh GITHUB_TOKEN=... bun scripts/patch-watch.ts --dry-run
```

The dry run only reads GitHub and the official forum and prints classifications;
it does not create a checkpoint or issues. The manual workflow defaults to dry
run. The scheduled workflow starts on the default branch after merge. Verify a
dry run, the baseline run and a subsequent successful check before disabling the
separate dot watcher. Do not leave both owning notifications indefinitely.

A source outage must not be worked around by treating empty notes as success.
Inspect the failure run, update fixtures/parser when the forum changes, and rerun.
Deleting or corrupting the checkpoint is not a recovery procedure: it can discard
tracking history. The workflow does not alter the site's Convex patch/news state.
