import { describe, expect, it } from "vitest"
import {
  parsePatchExcerpt,
  parsePatchForum,
  parsePatchPost,
} from "./forum-news"

function row(id: string, title: string, date = "Sep 10, 2026, 7:39:22 PM") {
  return `<tr><td class="thread"><div class="thread_title"><div class="title"><a href="/forum/view-thread/${id}">${title}</a></div></div><div class="forum_pagination"><a href="/forum/view-thread/${id}/page/2">2</a></div><div class="postBy"><span class="post_date">, ${date}</span></div></td><td class="last_post"><span class="post_date">Sep 12, 2026, 9:00:00 PM</span></td></tr>`
}

describe("patch forum", () => {
  it("uses original thread links and publication dates, ignores maintenance and deduplicates", () => {
    const html = `<table>${row("123", "0.5.5b Patch Notes")}${row("123", "0.5.5b Patch Notes")}${row("456", "0.5.5 Hotfix 10", "Sep 7, 2026, 8:03:36 PM")}${row("789", "Server Maintenance")}</table>`
    const result = parsePatchForum(html)
    expect(result.map((entry) => entry.id)).toEqual(["forum-123", "forum-456"])
    expect(result[0]).toMatchObject({
      kind: "patch",
      date: Date.UTC(2026, 8, 10),
      url: "https://www.pathofexile.com/forum/view-thread/123",
    })
  })
  it("decodes titles and rejects malformed links, missing dates, and challenge pages", () => {
    expect(
      parsePatchForum(row("123", "Patch Notes &amp; Hotfix"))[0].title
    ).toBe("Patch Notes & Hotfix")
    expect(() =>
      parsePatchForum(row("123/javascript:alert(1)", "Patch Notes"))
    ).toThrow()
    expect(() =>
      parsePatchForum(row("123", "Patch Notes", "invalid"))
    ).toThrow()
    expect(() =>
      parsePatchForum("<html>Please verify you are human</html>")
    ).toThrow()
  })
  it("extracts only the opening post, excluding replies and signatures", () => {
    const html =
      '<div class="content"><table><tr><td class="content-container"><div class="content"><h2>Patch Notes</h2><ul><li>Fixed a crash.</li><li>Improved loot &amp; rewards.</li></ul></div><div class="signature">Not patch content</div></td></tr><tr><td class="content-container"><div class="content">A player reply</div></td></tr></table></div>'
    expect(parsePatchExcerpt(html)).toBe(
      "Fixed a crash. Improved loot & rewards."
    )
    expect(() =>
      parsePatchExcerpt("<div class='content'>Challenge page</div>")
    ).toThrow()
  })
})

describe("formatted patch posts", () => {
  const page = (content: string) =>
    `<a href="/forum/view-forum/2212">Patch Notes</a><h1>0.5.5b Patch Notes</h1><table><tr><td class="content-container"><div class="content">${content}</div><div class="signature">Signature excluded</div></td></tr><tr><td class="content-container"><div class="content">Reply excluded</div></td></tr></table>`
  const url = "https://www.pathofexile.com/forum/view-thread/123"
  it("keeps nested formatting and original links without including replies", () => {
    const result = parsePatchPost(
      page(
        '<h2>Fixes</h2><ul><li>A fix<ul><li><strong>Nested fix</strong></li></ul></li></ul><ol start="3"><li>Third</li></ol><a href="/forum/view-thread/456">Details</a><table><tr><td colspan="2">Value</td></tr></table>'
      ),
      url
    )
    expect(result.title).toBe("0.5.5b Patch Notes")
    expect(result.html).toContain(
      "<ul><li>A fix<ul><li><strong>Nested fix</strong></li></ul></li></ul>"
    )
    expect(result.html).toContain(
      'href="https://www.pathofexile.com/forum/view-thread/456"'
    )
    expect(result.html).toContain('<ol start="3">')
    expect(result.html).not.toMatch(/Signature excluded|Reply excluded/)
  })
  it("strips executable content, unsafe URLs, event handlers, styles and clobbering attributes", () => {
    const result = parsePatchPost(
      page(
        '<script>alert(1)</script><iframe src="https://evil.test"></iframe><p style="display:none" onclick="alert(1)">Safe &amp; sound</p><a href="java&#x73;cript:alert(1)">Bad link</a><img src=x onerror=alert(1)><svg onload=alert(1)></svg><div id="main" name="location">Anchor</div><a href="#main">Jump</a>'
      ),
      url
    )
    expect(result.html).not.toMatch(
      /script|iframe|onclick|onerror|onload|style=|name=|<img|<svg/
    )
    expect(result.html).toContain('id="patch-main"')
    expect(result.html).toContain('href="#patch-main"')
    expect(result.html).toContain("Safe &amp; sound")
  })
  it("rejects unrelated forums and unavailable pages", () => {
    expect(() =>
      parsePatchPost(
        page("Fixes").replace("view-forum/2212", "view-forum/1"),
        url
      )
    ).toThrow()
    expect(() => parsePatchPost("<h1>Challenge</h1>", url)).toThrow()
  })
})

it("loads featured announcement 4000864's layout without mistaking replies for the post", () => {
  const html = `<title>Early Access Patch Notes - 0.5.5 Patch Notes - Forum - Path of Exile</title>
    <table class="forumTable forumPostListTable"><tr class="newsPost"><td colspan="2"><div class="content featured">
    <div id="top"><h2>Content Update 0.5.5 — Path of Exile 2: Forbidden Rites</h2></div>
    <div id="fixes"><h3>Bug Fixes</h3><ul><li>Fixed a crash.</li></ul><a href="#top">Return to top</a></div>
    <style>.newsPost li {margin: 0.5em}</style></div></td></tr>
    <tr class="newsPost newsPostInfo"><td>Posted by staff</td></tr>
    <tr><td class="content-container"><div class="content">nice!</div></td></tr></table>`
  const post = parsePatchPost(
    html,
    "https://www.pathofexile.com/forum/view-thread/4000864"
  )
  expect(post.title).toBe("0.5.5 Patch Notes")
  expect(post.html).toContain("<ul><li>Fixed a crash.</li></ul>")
  expect(post.html).toContain('href="#patch-top"')
  expect(post.html).not.toMatch(/nice!|Posted by|<style/)
  expect(() =>
    parsePatchPost(
      html.replace("Early Access Patch Notes", "Announcements"),
      "https://www.pathofexile.com/forum/view-thread/4000864"
    )
  ).toThrow()
})
