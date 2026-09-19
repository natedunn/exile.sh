import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { deflateSync, inflateSync } from "node:zlib"

const source = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
const xml = inflateSync(Buffer.from(source.trim(), "base64url"))
  .toString()
  .replace(
    /(<Item\b[^>]*>)([\s\S]*?)(<\/Item>)/g,
    (all, start, content, end) =>
      content.includes("Beast Cry")
        ? `${start}${content}\n{desecrated}Gain 23% of Damage as Extra Physical Damage\nCorrupted\n${end}`
        : all
  )
const code = deflateSync(xml).toString("base64url")

for (const width of [1440, 390, 1024]) {
  test(`inspection details retain textures, type and controls at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 1100 },
      hasTouch: width !== 1440,
      isMobile: width !== 1440,
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()
    try {
      await page.addInitScript(() =>
        localStorage.setItem("exile:item-affix-layout", "bullets")
      )
      await page.goto("/build-bin")
      await page.getByLabel("PoB export or pobb.in link").fill(code)
      const trigger = page.getByRole("button", {
        name: "Main hand: Beast Cry. Show item details",
      })
      await trigger.focus()
      await trigger.press("Enter")
      const popup = page.getByRole("dialog", { name: "Beast Cry", exact: true })
      await expect(popup.locator('[data-slot="popover-title"]')).toHaveCSS(
        "font-size",
        "24px"
      )
      const affix = popup
        .locator('li[data-kind="desecrated"]')
        .filter({ hasText: "Gain 23%" })
        .first()
      await expect(affix).toBeVisible()
      const texture = await affix.evaluate((el) => {
        const css = getComputedStyle(el),
          wash = getComputedStyle(el, "::before")
        return {
          font: parseFloat(css.fontSize),
          indent: parseFloat(css.marginLeft),
          mask: wash.maskImage,
          background: wash.backgroundImage,
          marker: getComputedStyle(el, "::marker").color,
          left: parseFloat(wash.left),
        }
      })
      expect(texture.indent).toBeCloseTo(texture.font * 1.25, 1)
      expect(texture.mask).toContain("fade-y.png")
      expect(texture.background).toContain("linear-gradient")
      expect(texture.marker).toContain("0.5")
      expect(texture.left).toBeLessThan(-texture.indent)
      const corrupted = popup.locator('[data-corrupted="true"]').last()
      const rule = await corrupted.evaluate((el) => ({
        mask: getComputedStyle(el, "::after").maskImage,
        background: getComputedStyle(el, "::after").backgroundImage,
        opacity: getComputedStyle(el, "::after").opacity,
        before: getComputedStyle(el, "::before").display,
      }))
      expect(rule.mask).toContain("repeating-conic-gradient")
      expect(rule.background).toContain("linear-gradient")
      expect(rule.opacity).toBe("0.75")
      expect(rule.before).toBe("none")
      if (width === 1440)
        await expect(popup.locator("kbd").first()).toHaveCSS(
          "border-top-width",
          "1px"
        )
      else
        await expect(popup.getByRole("button", { name: /^Pin / })).toHaveCSS(
          "width",
          "44px"
        )
      await page.evaluate(() => {
        localStorage.setItem("exile:item-affix-layout", "centered")
        window.dispatchEvent(new Event("exile:item-display-change"))
      })
      await expect
        .poll(() =>
          corrupted.evaluate((el) => getComputedStyle(el, "::before").display)
        )
        .not.toBe("none")
    } finally {
      await context.close()
    }
  })
}
