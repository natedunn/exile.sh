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

test("Base UI selects, page links, and tooltip support keyboard interaction", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await expect(page.locator(".currency-table tbody tr").first()).toBeVisible()
  const league = page.getByRole("combobox", { name: "League", exact: true })
  await league.click()
  await expect(page.getByRole("listbox")).toBeVisible()
  await page.getByRole("option", { name: "Standard", exact: true }).click()
  await expect(league).toContainText("Standard")
  await expect(page).toHaveURL(/league=Standard/)
  await league.click()
  await expect(page.getByRole("listbox")).toBeVisible()
  await expect(
    page.getByRole("option", { name: "Standard", exact: true })
  ).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("listbox")).toHaveCount(0)
  await expect(league).toBeFocused()

  const quote = page.getByRole("combobox", {
    name: "Quote currency",
    exact: true,
  })
  await quote.focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("listbox")).toBeVisible()
  await page.getByRole("option", { name: "Chaos", exact: true }).click()
  await expect(quote).toContainText("Chaos")
  await expect(page).toHaveURL(/quote=Chaos/)

  await page.getByRole("link", { name: "Currency market", exact: true }).focus()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("link", { name: "Market movers", exact: true })
  ).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/economy\/movers/)
  await expect(
    page.getByRole("link", { name: "Market movers", exact: true })
  ).toHaveAttribute("aria-current", "page")
  const help = page.getByRole("button", {
    name: "How market movers are ranked",
    exact: true,
  })
  await page.keyboard.press("Tab")
  await help.focus()
  await expect(help).toBeFocused()
  await expect(page.getByRole("tooltip")).toContainText("1,000 Exalted")
  await expect(help).toHaveAccessibleDescription(/1,000 Exalted/)
  expect(errors).toEqual([])
})

test("input groups own focus styling without page-specific classes", async ({
  page,
}) => {
  await page.goto("/")
  const input = page.getByRole("textbox", {
    name: "Search currencies",
    exact: true,
  })
  await expect(input).toBeVisible()
  const group = input.locator("..")
  await expect(group).toHaveAttribute("data-slot", "input-group")
  // Removing the layout class must not remove the component's focus treatment.
  await group.evaluate((element) => element.classList.remove("search-input"))
  const unfocusedBorder = await group.evaluate(
    (element) => getComputedStyle(element).borderColor
  )
  await input.focus()
  const focused = await input.evaluate((element) => ({
    innerOutline: getComputedStyle(element).outlineStyle,
    innerShadow: getComputedStyle(element).boxShadow,
    groupShadow: getComputedStyle(element.parentElement!).boxShadow,
    groupBorder: getComputedStyle(element.parentElement!).borderColor,
  }))
  expect(focused.innerOutline).toBe("none")
  expect(focused.innerShadow).toBe("none")
  expect(focused.groupShadow).toContain("3px")
  expect(focused.groupBorder).not.toBe(unfocusedBorder)
  await input.blur()
  expect(
    await group.evaluate((element) => getComputedStyle(element).boxShadow)
  ).toBe("none")
})

test("movers have separate ranked top tens and preserve league and quote navigation", async ({
  page,
}) => {
  await page.goto("/economy/movers?quote=Chaos")
  await expect(
    page.getByRole("heading", { name: "Market movers", exact: true })
  ).toBeVisible()
  await expect(page.locator(".losers .mover-row")).toHaveCount(10)
  await expect(page.locator(".gainers .mover-row")).toHaveCount(10)
  for (const [selector, increasing] of [
    [".losers", true],
    [".gainers", false],
  ] as const) {
    const values = (
      await page.locator(`${selector} .delta`).allTextContents()
    ).map((text) => Number(text.replace(/[^0-9.+-]/g, "")))
    expect(values.every((value) => (increasing ? value < 0 : value > 0))).toBe(
      true
    )
    for (let i = 1; i < values.length; i++) {
      expect(
        increasing ? values[i] >= values[i - 1] : values[i] <= values[i - 1]
      ).toBe(true)
    }
  }
  await page.locator(".losers .mover-row").first().click()
  await expect(page.locator(".chart-wrap")).toBeVisible()
  await page.reload()
  await expect(page.locator(".chart-wrap")).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Quote currency", exact: true })
  ).toContainText("Chaos")
  await page.getByRole("link", { name: "Economy", exact: true }).click()
  await expect(page.locator(".currency-table")).toBeVisible()
  await expect(page.locator(".movers-section")).toHaveCount(0)
  await expect(
    page.getByRole("combobox", { name: "Quote currency", exact: true })
  ).toContainText("Chaos")
  await expect(page.locator(".categories .item-icon").first()).toBeVisible()
})

test("economy routes redirect to the market and provide page navigation", async ({
  page,
}) => {
  await page.goto("/economy?quote=Divine")
  await expect(page).toHaveURL(/\/economy\/market\?.*quote=Divine/)
  await expect(
    page.getByRole("link", { name: "Currency market", exact: true })
  ).toHaveAttribute("aria-current", "page")
  await expect(
    page.getByRole("link", { name: "Exchange pairs", exact: true })
  ).toHaveCount(0)
  const nav = page.getByRole("navigation", {
    name: "Economy views",
    exact: true,
  })
  await nav.getByRole("link", { name: "Market movers", exact: true }).click()
  await expect(page).toHaveURL(/\/economy\/movers/)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Market movers", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Quote currency", exact: true })
  ).toContainText("Divine")
  await page.goBack()
  await expect(page).toHaveURL(/\/economy\/market/)
})
