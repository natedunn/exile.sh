import { expect, test } from "@playwright/test"

for (const width of [320, 768]) {
  test(`shared selects fit their options at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const [path, name] of [
      ["/economy/movers", "Movers period"],
      ["/economy/market", "Category"],
      ["/economy/market", "League"],
      ["/economy/market", "Quote currency"],
    ]) {
      await page.goto(path)
      await page.locator(".currency-row, .mover-row").first().waitFor()
      if (name === "League")
        await page
          .getByRole("button", { name: "Open main menu", exact: true })
          .click()
      await page.getByRole("combobox", { name, exact: true }).click()
      await expect(page.getByRole("listbox")).toBeVisible()
      const sizing = await page
        .locator('[data-slot="select-content"]')
        .evaluate((popup) => ({
          left: popup.getBoundingClientRect().left,
          right: popup.getBoundingClientRect().right,
          clipped: [
            ...popup.querySelectorAll('[data-slot="select-item"]'),
          ].some((option) => option.scrollWidth > option.clientWidth),
        }))
      expect(sizing.left).toBeGreaterThanOrEqual(0)
      expect(sizing.right).toBeLessThanOrEqual(width)
      expect(sizing.clipped).toBe(false)
      if (name === "Movers period") {
        await page
          .getByRole("option", { name: "3 months (90 days)", exact: true })
          .click()
        await expect(
          page.getByRole("combobox", { name, exact: true })
        ).toContainText("3 months (90 days)")
      } else await page.keyboard.press("Escape")
    }
  })
}
