import { expect, test } from "@playwright/test"

test("an open mobile menu closes at the shared desktop breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 990, height: 900 })
  await page.goto("/economy/market")
  // Wait for hydration, not just the server-rendered button.
  await page.getByTestId("currency-row").first().waitFor()
  const breakpoint = await page.evaluate(() =>
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--breakpoint-lg"
      )
    )
  )
  expect(breakpoint).toBe(1000)
  const trigger = page.getByRole("button", { name: "Open main menu" })
  const sheet = page.locator('[data-slot="sheet-content"]')
  for (const desktopWidth of [breakpoint, 1010, 1023, 1024]) {
    await page.setViewportSize({ width: breakpoint - 1, height: 900 })
    await trigger.click()
    await expect(sheet).toBeVisible()
    await page.setViewportSize({ width: desktopWidth, height: 900 })
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeHidden()
    await expect(
      page.locator('header nav[aria-label="Main navigation"]')
    ).toBeVisible()
  }
  await page.setViewportSize({ width: breakpoint - 1, height: 900 })
  await expect(trigger).toBeVisible()
  await expect(sheet).toBeHidden()
})
