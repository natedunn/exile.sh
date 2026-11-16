import { linesFromHtml } from "./patch-watch-source"

import {
  PATCH_FORUM,
  parsePatchForum,
  parsePatchPost,
} from "../shared/forum-news"
import { fetchForum } from "../shared/fetch-forum"
import {
  analyze,
  digest,
  isManaged,
  FAILURE_MARKER,
  STATE_MARKER,
  readState,
  reconcile,
  stateBody,
  selectPosts,
} from "./patch-watch-core.mjs"

const repository = process.env.GITHUB_REPOSITORY
const token = process.env.GITHUB_TOKEN
const dryRun = process.argv.includes("--dry-run")
if (repository !== "natedunn/exile.sh")
  throw new Error("Expected GITHUB_REPOSITORY=natedunn/exile.sh")
if (!token) throw new Error("GITHUB_TOKEN is required (read-only for dry runs)")
const base = `https://api.github.com/repos/${repository}`
async function api(path: string, method = "GET", body?: unknown) {
  if (dryRun && method !== "GET")
    throw new Error("Dry runs cannot write GitHub state")
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok)
    throw new Error(
      `GitHub ${method} ${path.split("?")[0]} returned ${response.status}`
    )
  return response.json()
}
async function allIssues() {
  const issues = []
  for (let page = 1; ; page++) {
    const batch = await api(`/issues?state=all&per_page=100&page=${page}`)
    issues.push(...batch)
    if (batch.length < 100) return issues
    if (page >= 100)
      throw new Error(
        "Issue history exceeds safe scan limit; refusing incomplete deduplication"
      )
  }
}
async function saveIssue(existing: any, body: any) {
  return api(
    existing ? `/issues/${existing.number}` : "/issues",
    existing ? "PATCH" : "POST",
    body
  )
}
async function run() {
  const issues = await allIssues()
  const checkpoints = issues.filter(
    (issue) =>
      !issue.pull_request &&
      isManaged(issue) &&
      issue.body?.startsWith(STATE_MARKER)
  )
  if (checkpoints.length > 1)
    throw new Error(
      "Multiple patch-watch checkpoints; resolve before continuing"
    )
  const checkpoint = checkpoints[0]
  const state = checkpoint
    ? readState(checkpoint.body)
    : { version: 1, startedAt: Date.now(), posts: {} }
  const discovered = parsePatchForum(await fetchForum(PATCH_FORUM)).slice(
    0,
    100
  )
  // Revisit known posts even when they fall off the first forum page. Keep a
  // bounded rolling window; every entry in this window is checked on every run.
  const known = Object.entries(state.posts).map(
    ([id, entry]: [string, any]) => ({
      id,
      url: entry.url,
      date: entry.date ?? state.startedAt,
      title: "",
    })
  )
  const candidates = selectPosts(known, discovered)
  const posts = []
  for (const entry of candidates) {
    if (
      !/^forum-\d{1,12}$/.test(entry.id) ||
      entry.url !==
        `https://www.pathofexile.com/forum/view-thread/${entry.id.slice(6)}`
    )
      throw new Error("Invalid source identity in checkpoint")
    const parsed = parsePatchPost(await fetchForum(entry.url), entry.url)
    posts.push({
      ...entry,
      ...parsed,
      owner: "natedunn",
      lines: linesFromHtml(parsed.html),
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  if (dryRun) {
    console.log(
      JSON.stringify(
        posts.map((post) => ({ url: post.url, ...analyze(post.lines) })),
        null,
        2
      )
    )
    return
  }
  let next
  if (!checkpoint) {
    // No alert flood for years of old notes. The first successful fetch establishes
    // a baseline; a failed fetch does not create a partial checkpoint.
    next = {
      ...state,
      posts: Object.fromEntries(
        posts.map((post) => [
          post.id,
          {
            hash: digest(JSON.stringify([post.title, post.lines])),
            evidence: analyze(post.lines).fingerprint,
            url: post.url,
            date: post.date,
          },
        ])
      ),
    }
  } else {
    next = await reconcile({ posts, state, issues, saveIssue })
    const ids = new Set(posts.map((post) => post.id))
    next.posts = Object.fromEntries(
      Object.entries(next.posts).filter(([id]) => ids.has(id))
    )
    for (const post of posts) next.posts[post.id].date = post.date
  }
  const body = stateBody(next)
  if (body.length > 60_000)
    throw new Error("Checkpoint exceeds safe GitHub issue size")
  if (checkpoint?.body !== body || checkpoint?.state !== "closed") {
    const saved = await saveIssue(checkpoint, {
      title: "Patch watcher checkpoint (keep closed)",
      body,
      state: "closed",
    })
    // GitHub create-issue ignores state; close only after successful creation.
    if (!checkpoint)
      await api(`/issues/${saved.number}`, "PATCH", { state: "closed" })
  }
  const failure = issues.find(
    (issue) =>
      !issue.pull_request &&
      isManaged(issue) &&
      issue.body?.startsWith(FAILURE_MARKER) &&
      issue.state === "open"
  )
  if (failure)
    await api(`/issues/${failure.number}`, "PATCH", { state: "closed" })
  console.log(
    `Checked ${posts.length} official posts; ${checkpoint ? "checkpoint saved" : "baseline established (no historical alerts)"}.`
  )
}
try {
  await run()
} catch (error) {
  console.error(error)
  if (!dryRun) {
    try {
      const issues = await allIssues()
      const existing = issues.find(
        (issue) =>
          !issue.pull_request &&
          isManaged(issue) &&
          issue.body?.startsWith(FAILURE_MARKER)
      )
      if (!existing || existing.state !== "open")
        await saveIssue(existing, {
          title: "PoE2 patch watcher needs attention",
          state: "open",
          body: `${FAILURE_MARKER}\n@natedunn The patch check failed. No successful completion is claimed. Inspect [the workflow run](https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}) for the error, check official forum availability/parser changes and GitHub permissions, then rerun. This issue is reused until recovery; it closes after a successful check.`,
        })
    } catch (reportError) {
      console.error("Could not report watcher failure to GitHub:", reportError)
    }
  }
  process.exitCode = 1
}
