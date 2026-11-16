import test from "node:test"
import assert from "node:assert/strict"
import { linesFromHtml } from "./patch-watch-source"
import { parsePatchPost } from "../shared/forum-news"

test("mixed paragraphs and nested lists preserve parent context and each change", () => {
  assert.deepEqual(
    linesFromHtml(
      "<p>Added a new league.</p><ul><li>Changed Fireball:<ul><li>20% less damage.</li></ul></li></ul>"
    ),
    ["Added a new league.", "Changed Fireball:", "20% less damage."]
  )
})
test("official opening-post parser excludes replies and hostile markup", () => {
  const html =
    '<a href="/forum/view-forum/2212">Patch Notes</a><h1>1.0 Patch Notes</h1><td class="content-container"><div class="content"><p>Added an item.</p><script>doEvil()</script><ul><li>Reduced skill damage.</li></ul></div></td><td class="content-container"><div class="content">Added false reply content.</div></td>'
  const post = parsePatchPost(
    html,
    "https://www.pathofexile.com/forum/view-thread/123"
  )
  assert.deepEqual(linesFromHtml(post.html), [
    "Added an item.",
    "Reduced skill damage.",
  ])
})
