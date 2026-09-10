import { expect, test } from "@playwright/test"

test("search, watchlist persistence, chart, pairs, and attribution", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page
    .getByRole("textbox", { name: "Search currencies", exact: true })
    .fill("Divine Orb")
  await expect(page.locator(".currency-table tbody tr")).toHaveCount(1)
  await page
    .getByRole("button", { name: "Add Divine Orb to watchlist", exact: true })
    .click()
  await page.reload()
  await expect(
    page.getByRole("button", {
      name: "Remove Divine Orb from watchlist",
      exact: true,
    })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "View Divine Orb history", exact: true })
    .click()
  await expect(page.locator(".chart-wrap")).toBeVisible()
  await page.getByRole("button", { name: "24H", exact: true }).click()
  await expect(page.locator(".history-caption")).toContainText(
    "hourly observations"
  )
  await page.getByText("View chart data", { exact: true }).click()
  expect(await page.locator(".history-data tbody tr").count()).toBeGreaterThan(
    1
  )
  await page.getByRole("button", { name: "Invert pairs", exact: true }).click()
  await expect(page.locator(".pairs-table tbody tr")).toHaveCount(20)
  await page
    .getByRole("link", { name: "Data & attribution", exact: true })
    .click()
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Follow the trade"
  )
  expect(errors).toEqual([])
})

test("mobile market stays within the viewport and categories filter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.locator(".currency-table tbody tr").first()).toBeVisible()
  await page.getByRole("button", { name: /^Essences/ }).click()
  await expect(page.locator(".currency-table tbody tr").first()).toContainText(
    "Essence"
  )
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
  await page.screenshot({
    path: "test-results/mobile-economy.png",
    fullPage: true,
  })
})

for (const width of [320, 375, 414, 768]) {
  test(`workbench remains readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 })
    await page.goto("/")
    await expect(page.locator(".currency-table tbody tr").first()).toBeVisible()
    const layout = await page.evaluate(() => {
      const root = document.documentElement
      const main = document.querySelector("#main")!.getBoundingClientRect()
      const table = document
        .querySelector(".currency-table")!
        .getBoundingClientRect()
      return {
        viewport: innerWidth,
        scroll: root.scrollWidth,
        mainRight: main.right,
        tableRight: table.right,
        rootOverflow: getComputedStyle(root).overflowX,
        bodyOverflow: getComputedStyle(document.body).overflowX,
      }
    })
    expect(layout.scroll).toBeLessThanOrEqual(width)
    expect(layout.mainRight).toBeLessThanOrEqual(width)
    expect(layout.tableRight).toBeLessThanOrEqual(width)
    expect(layout.rootOverflow).toBe("clip")
    expect(layout.bodyOverflow).toBe("clip")
    await page.screenshot({
      path: `test-results/workbench-${width}.png`,
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "View Divine Orb history", exact: true })
      .click()
    await expect(page.locator(".chart-wrap")).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width)
  })
}
