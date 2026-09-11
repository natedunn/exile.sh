import { expect, test } from "@playwright/test"

for (const quote of ["Auto", "Chaos", "Exalted"] as const) {
  test(`${quote} survives logo links, refresh, and methodology`, async ({
    page,
  }) => {
    await page.goto("/economy/market?league=Standard")
    await page.locator(".currency-row").first().waitFor()
    const picker = page.getByRole("combobox", {
      name: "Quote currency",
      exact: true,
    })
    await picker.click()
    await page.getByRole("option", { name: quote, exact: true }).click()
    await expect(picker).toContainText(quote)
    await page.reload()
    await expect(picker).toContainText(quote)
    for (const selector of [".wordmark", ".footer-brand"]) {
      await page.locator(selector).click()
      await expect(picker).toContainText(quote)
      expect(new URL(page.url()).searchParams.get("quote")).toBe(
        quote === "Auto" ? null : quote
      )
      await expect(page).toHaveURL(/league=Standard/)
    }
    await page
      .getByRole("link", { name: "Data & attribution", exact: true })
      .click()
    await page.reload()
    await page
      .getByRole("link", { name: "← Back to the economy", exact: true })
      .click()
    await expect(picker).toContainText(quote)
    await expect(page).toHaveURL(/league=Standard/)
    await page.getByRole("link", { name: "Market movers", exact: true }).click()
    await expect(picker).toContainText(quote)
  })
}
