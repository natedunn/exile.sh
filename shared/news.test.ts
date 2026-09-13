import { describe, expect, it } from "vitest"
import { plainExcerpt } from "./news"

describe("patch excerpts", () => {
  it("strips media and formatting and limits excerpts on a word boundary", () => {
    expect(
      plainExcerpt(
        "[img]https://example.com/image.jpg[/img]<b>Hello</b> {STEAM_CLAN_IMAGE}/pic.jpg [url=https://example.com]world[/url]"
      )
    ).toBe("Hello world")
    expect(plainExcerpt("One two three four five", 14)).toBe("One two three…")
  })
})
