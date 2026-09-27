import { expect, test } from "@playwright/test"

// PNG width and height live at bytes 16–23 of the IHDR chunk.
const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)]

test("gem share cards render as 1200 × 630 PNGs", async ({ request }) => {
  for (const path of ["/og/gems", "/og/gems/lightning-arrow"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toBe("image/png")
    expect(size(await response.body())).toEqual([1200, 630])
  }
  expect((await request.get("/og/gems/not-a-gem")).status()).toBe(404)
})

test("gem pages point crawlers at their share cards", async ({ request }) => {
  const meta = async (path: string) => {
    const html = await (await request.get(path)).text()
    return {
      title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
      image: /property="og:image" content="([^"]*)"/.exec(html)?.[1],
      canonical: /rel="canonical" href="([^"]*)"/.exec(html)?.[1],
    }
  }
  const gem = await meta("/gems/lightning-arrow")
  expect(gem.title).toBe("Lightning Arrow · Gems · exile.sh")
  expect(gem.image).toMatch(/\/og\/gems\/lightning-arrow$/)
  expect(gem.canonical).toMatch(/\/gems\/lightning-arrow$/)
  // Old skill-id links share and canonicalise to the readable slug.
  expect((await meta("/gems/LightningArrowPlayer")).canonical).toMatch(
    /\/gems\/lightning-arrow$/
  )
  expect((await meta("/gems")).image).toMatch(/\/og\/gems$/)
})
