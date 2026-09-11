import { expect, test } from "@playwright/test"

async function withinViewport(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(page.viewportSize()!.width)
}
async function scrollTable(region: import("@playwright/test").Locator) {
  const sizes = await region.evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
  }))
  if (sizes.scroll > sizes.client) {
    await region.scrollIntoViewIfNeeded()
    await region.focus()
    await expect(region).toBeFocused()
    await region.press("ArrowRight")
    await expect
      .poll(() => region.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0)
    await region.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    await expect
      .poll(() => region.evaluate((el) => el.scrollLeft + el.clientWidth))
      .toBeGreaterThanOrEqual(sizes.scroll - 1)
    await region.evaluate((el) => {
      el.scrollLeft = 0
    })
  }
}
for (const width of [320, 375, 414, 768, 1024, 1440]) {
  test(`actual pages and scrollable tables at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/economy/market")
    await expect(page.locator(".currency-row").first()).toBeVisible()
    await withinViewport(page)
    for (const th of await page.locator(".currency-table th").all())
      await expect(th).toBeVisible()
    await scrollTable(
      page.getByRole("region", { name: /^Currency market, scroll/ })
    )
    if (width <= 900) {
      const category = page.getByRole("combobox", {
        name: "Category",
        exact: true,
      })
      await category.click()
      await expect(page.getByRole("listbox")).toBeVisible()
      await page.getByRole("option", { name: "Essences", exact: true }).click()
      await expect(page.locator(".currency-row").first()).toContainText(
        "Essence"
      )
      await page.reload()
      await expect(category).toContainText("Essences")
      await category.click()
      await page.getByRole("option", { name: "Watchlist", exact: true }).click()
      await expect(
        page.getByText("No currencies found.", { exact: true })
      ).toBeVisible()
      await category.click()
      await page
        .getByRole("option", { name: "All currencies", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Open main menu", exact: true })
        .click()
      const sheet = page.getByRole("dialog", { name: "Main menu", exact: true })
      await expect(sheet).toBeVisible()
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("Tab")
        await expect
          .poll(() =>
            sheet.evaluate((element) =>
              element.contains(document.activeElement)
            )
          )
          .toBe(true)
      }
      const nav = page.getByRole("navigation", {
        name: "Main navigation",
        exact: true,
      })
      await expect(
        nav.getByRole("link", { name: "Economy", exact: true })
      ).toBeVisible()
      await expect(
        nav.getByRole("link", { name: "Builds", exact: true })
      ).toBeVisible()
      await nav.getByRole("link", { name: "Economy", exact: true }).focus()
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("button", { name: "Open main menu", exact: true })
      ).toBeFocused()
      await page
        .getByRole("button", { name: "Open main menu", exact: true })
        .click()
      await nav.getByRole("link", { name: "Economy", exact: true }).click()
      await expect(
        page.getByRole("button", { name: "Open main menu", exact: true })
      ).toBeVisible()
    }
    await page.evaluate(() => {
      ;(document.activeElement as HTMLElement)?.blur()
      window.scrollTo(0, 0)
    })
    await page.screenshot({
      path: `test-results/responsive-market-${width}.png`,
    })
    await page.goto("/economy/movers")
    await expect(page.locator(".mover-row").first()).toBeVisible()
    await withinViewport(page)
    await page.screenshot({
      path: `test-results/responsive-movers-${width}.png`,
    })
    await page.locator(".mover-row").first().click()
    await expect(page.locator(".chart-wrap")).toBeVisible()
    await withinViewport(page)
    await scrollTable(
      page.getByRole("region", { name: /^Exchange pairs, scroll/ })
    )
    await page
      .getByRole("button", { name: "View chart data", exact: true })
      .click()
    await expect(page.locator(".history-data tbody tr").first()).toBeVisible()
    await scrollTable(
      page.getByRole("region", { name: /^Price history data, scroll/ })
    )
    const historyBounds = await page.locator(".history-data").evaluate((el) => {
      const table = el.querySelector('[data-slot="table-container"]')!
      const next = el.nextElementSibling!
      return {
        tableBottom: table.getBoundingClientRect().bottom,
        nextTop: next.getBoundingClientRect().top,
      }
    })
    expect(historyBounds.tableBottom).toBeLessThanOrEqual(historyBounds.nextTop)
    await page.evaluate(() => {
      ;(document.activeElement as HTMLElement)?.blur()
      window.scrollTo(0, 0)
    })
    await page.screenshot({
      path: `test-results/responsive-detail-${width}.png`,
      fullPage: true,
    })
    await page.goto("/methodology")
    await withinViewport(page)
    await page.screenshot({
      path: `test-results/responsive-methodology-${width}.png`,
    })
    expect(errors).toEqual([])
  })
}
