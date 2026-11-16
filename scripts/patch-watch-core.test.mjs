import test from "node:test"
import assert from "node:assert/strict"
import {
  analyze,
  digest,
  issueBody,
  marker,
  quote,
  readState,
  reconcile,
  stateBody,
} from "./patch-watch-core.mjs"
const post = {
  id: "forum-123",
  title: "1.0.0 Patch Notes",
  url: "https://www.pathofexile.com/forum/view-thread/123",
  date: 1794873600000,
  owner: "natedunn",
  lines: ["Increased Fireball gem damage by 10%."],
}
const state = () => ({ version: 1, posts: {} })
function harness(issues = []) {
  const calls = []
  return {
    issues,
    calls,
    saveIssue: async (existing, fields) => {
      calls.push({ existing, fields })
      return {
        ...fields,
        user: { login: "github-actions[bot]", type: "Bot" },
        number: existing?.number ?? 1,
      }
    },
  }
}
test("ignores routine operations but retains gameplay changes", () => {
  assert.equal(
    analyze(["Fixed a server crash.", "Improved server stability."]).significant
      .length,
    0
  )
  assert.equal(
    analyze(["Reduced damage of skills."]).matches[0].name,
    "Skills and supports"
  )
})
test("broad unfamiliar change gets explicit coverage review rather than silently disappearing", () => {
  const result = analyze(["Added Chronogates to the wilderness."])
  assert.equal(result.unknown.length, 1)
  assert.match(issueBody(post, result), /not a claim of breakage/)
})
test("multiple connected data families are retained", () => {
  const result = analyze([
    "Changed support gem socket requirements on unique weapons.",
  ])
  assert.ok(result.matches.length >= 3)
})
test("escapes upstream mentions and markdown", () => {
  assert.equal(
    quote("@everyone <script> [click](x)"),
    "＠everyone script click(x)"
  )
  assert.doesNotMatch(
    issueBody({ ...post, title: "@other <b>" }, analyze(post.lines)),
    /@other|<b>/
  )
})
test("creates one actionable issue, repeat is quiet", async () => {
  const h = harness()
  const next = await reconcile({ posts: [post], state: state(), ...h })
  assert.equal(h.calls.length, 1)
  assert.match(h.calls[0].fields.body, /gem-compatibility/)
  await reconcile({ posts: [post], state: next, ...h })
  assert.equal(h.calls.length, 1)
})
test("retry after checkpoint-write failure cannot duplicate the issue", async () => {
  const h = harness()
  await reconcile({ posts: [post], state: state(), ...h })
  await reconcile({ posts: [post], state: state(), ...h })
  assert.equal(h.calls.length, 1)
})
test("edited gameplay notes reopen same closed issue", async () => {
  const h = harness()
  const next = await reconcile({ posts: [post], state: state(), ...h })
  h.issues[0].state = "closed"
  await reconcile({
    posts: [{ ...post, lines: ["Reduced Fireball gem damage by 20%."] }],
    state: next,
    ...h,
  })
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].existing.number, 1)
  assert.equal(h.calls[1].fields.state, "open")
})
test("operational-only edit does not notify again", async () => {
  const h = harness()
  const next = await reconcile({ posts: [post], state: state(), ...h })
  await reconcile({
    posts: [{ ...post, lines: [...post.lines, "Fixed a server crash."] }],
    state: next,
    ...h,
  })
  assert.equal(h.calls.length, 1)
})
test("closed human issues and existing PRs with source URL suppress duplicate ownership", async () => {
  for (const extra of [{ state: "closed" }, { pull_request: {} }]) {
    const h = harness([
      {
        body: `Already reviewing ${post.url}`,
        user: { login: "natedunn" },
        ...extra,
      },
    ])
    await reconcile({ posts: [post], state: state(), ...h })
    assert.equal(h.calls.length, 0)
  }
})
test("state round trips, checkpoint URL is not mistaken for external ownership", async () => {
  const initial = state()
  initial.posts[post.id] = {
    hash: digest("old"),
    evidence: digest("old"),
    url: post.url,
  }
  assert.deepEqual(readState(stateBody(initial)), initial)
  const h = harness([{ body: stateBody(initial), state: "closed" }])
  await reconcile({ posts: [post], state: initial, ...h })
  assert.equal(h.calls.length, 1)
  assert.match(h.calls[0].fields.body, new RegExp(marker(post.id)))
  assert.throws(() => readState("bad"))
})
test("implicit numerical changes remain visible", () => {
  for (const line of [
    "Fireball: 20% less damage at all levels.",
    "Maximum Spectres: 5 (previously 4).",
    "Deals 30 to 50 Fire Damage.",
  ])
    assert.equal(analyze([line]).significant.length, 1)
})
test("untrusted marker or URL cannot claim patch ownership", async () => {
  const h = harness([
    {
      number: 4,
      user: { login: "outsider" },
      body: `${marker(post.id)} ${post.url}`,
    },
  ])
  await reconcile({ posts: [post], state: state(), ...h })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].existing, undefined)
})
test("a human-owned URL does not suppress a later gameplay edit", async () => {
  const h = harness([
    { number: 4, user: { login: "natedunn" }, body: post.url, state: "closed" },
  ])
  const next = await reconcile({ posts: [post], state: state(), ...h })
  assert.equal(h.calls.length, 0)
  await reconcile({
    posts: [{ ...post, lines: ["Added a new unique weapon."] }],
    state: next,
    ...h,
  })
  assert.equal(h.calls.length, 1)
})
test("rolling window retains newest tracked notes and new notes without churn", async () => {
  const { selectPosts } = await import("./patch-watch-core.mjs")
  const known = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    date: 100 - i,
  }))
  const selected = selectPosts(known, [{ id: "new", date: 101 }])
  assert.equal(selected.length, 100)
  assert.equal(selected[0].id, "new")
  assert.equal(selected[1].id, "0")
  assert.equal(selected.at(-1).id, "98")
})
test("retracted actionable text updates the managed issue instead of keeping stale advice", async () => {
  const h = harness()
  const next = await reconcile({ posts: [post], state: state(), ...h })
  await reconcile({
    posts: [{ ...post, lines: ["Fixed a server crash."] }],
    state: next,
    ...h,
  })
  assert.equal(h.calls.length, 2)
  assert.match(h.calls[1].fields.body, /Previously actionable text was removed/)
  assert.doesNotMatch(h.calls[1].fields.body, /gem-compatibility/)
})
