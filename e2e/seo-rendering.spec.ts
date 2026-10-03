import { expect, test } from "@playwright/test"
import { parseDocument } from "htmlparser2"
import { textContent } from "domutils"

// Serialized loader data is not rendered content: exclude scripts from assertions.
const visibleText = (html: string) =>
  textContent(
    parseDocument(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    )
  )

test("gem content and compatible links are present before JavaScript runs", async ({
  request,
}) => {
  for (const [slug, name, effect] of [
    [
      "lightning-arrow",
      "Lightning Arrow",
      "Converts 80% of Physical damage to Lightning damage",
    ],
    [
      "loyalty",
      "Loyalty",
      "Minions from Supported Skills have 30% less maximum Life",
    ],
    ["wolf-pack", "Wolf Pack", "Summons (3–6) Wolves"],
  ]) {
    const response = await request.get(`/gems/${slug}`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const text = visibleText(html)
    expect(html).toMatch(new RegExp(`<h1[^>]*>${name}</h1>`))
    expect(text).toContain("Description")
    expect(text).toContain(effect)
    expect(text).toContain("Gem stats")
    expect(text).not.toContain("Loading gem")
    expect(text).not.toContain("Loading compatible gems")
    expect(html).toMatch(/href="\/gems\/[a-z0-9-]+/)
  }
  expect((await request.get("/gems/not-a-gem")).status()).toBe(404)
})

test("selected gem level and quality render on the server", async ({
  request,
}) => {
  const response = await request.get(
    "/gems/lightning-arrow?gemLevel=20&gemQuality=20"
  )
  expect(response.status()).toBe(200)
  const html = await response.text()
  const text = visibleText(html)
  expect(text).toContain("Level 20")
  expect(text).toContain("40% more chance to Shock")
  expect(text).toContain("Requirements")
  expect(html).toMatch(/rel="canonical" href="[^"]*\/gems\/lightning-arrow"/)
})

test("root is an indexable homepage with links to every tool family", async ({
  request,
}) => {
  const response = await request.get("/", { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(visibleText(html)).toContain("Path of Exile 2")
  expect(visibleText(html)).toContain("Greetings, exile.")
  expect(html.match(/<h1\b/g)).toHaveLength(1)
  expect(html).toMatch(
    /<h1[^>]*>[\s\S]*?exile\.sh: A collection of Path of Exile tools[\s\S]*?<\/h1>/
  )
  expect(html).toContain(
    "<title>exile.sh: A Collection of Path of Exile Tools</title>"
  )
  for (const path of [
    "/economy/market",
    "/gems",
    "/items",
    "/trees/passive",
    "/trees/genesis",
    "/build-bin",
    "/patch-notes",
  ])
    expect(html).toMatch(
      new RegExp(`href="${path.replaceAll("/", "\\/")}(?:[?\"])`)
    )
  expect(html).toMatch(/rel="canonical" href="https?:\/\/[^"/]+\/"/)
  expect(html.match(/<h3\b/g)).toHaveLength(24)
  for (const text of [
    "All free and all open source.",
    "Smart conversions",
    "Private highlights",
    "Compatible gems",
  ])
    expect(visibleText(html)).toContain(text)
  expect(html).not.toContain("noindex")
})

test("the original homepage preview remains preserved", async ({ request }) => {
  const preview = await request.get("/home-preview")
  expect(preview.status()).toBe(200)
  const html = await preview.text()
  expect(html.match(/<h3\b/g)).toHaveLength(24)
  expect(visibleText(html)).toContain("kind of obsessed")
  expect(html).toMatch(/name="robots" content="noindex, follow"/)
  expect(html).toMatch(/rel="canonical" href="https?:\/\/[^"/]+\/home-preview"/)
})
