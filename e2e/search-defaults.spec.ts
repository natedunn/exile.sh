import { expect, test } from "@playwright/test"

const params = (url: string) => Object.fromEntries(new URL(url).searchParams)

test("defaults stay out of URLs and only changed filters are shared", async ({
  page,
  context,
}) => {
  await page.goto("/")
  await expect(page.locator(".currency-row").first()).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/economy/market")
  expect(params(page.url())).toEqual({})
  const quote = page.getByRole("combobox", {
    name: "Quote currency",
    exact: true,
  })
  await expect(quote).toContainText("Auto")
  await page.getByRole("link", { name: "Market movers", exact: true }).click()
  expect(params(page.url())).toEqual({})
  await quote.click()
  await page.getByRole("option", { name: "Chaos", exact: true }).click()
  await expect(quote).toContainText("Chaos")
  expect(params(page.url())).toEqual({ quote: "Chaos" })
  await page.getByRole("link", { name: "Currency market", exact: true }).click()
  await page
    .getByRole("textbox", { name: "Search currencies", exact: true })
    .fill("Divine Orb")
  await expect(page.locator(".currency-row")).toHaveCount(1)
  expect(params(page.url())).toEqual({ quote: "Chaos", q: "Divine Orb" })
  const shared = await context.newPage()
  await shared.goto(page.url())
  await expect(
    shared.getByRole("combobox", { name: "Quote currency", exact: true })
  ).toContainText("Chaos")
  await expect(
    shared.getByRole("textbox", { name: "Search currencies", exact: true })
  ).toHaveValue("Divine Orb")
  await shared.close()
  await page.reload()
  await expect(quote).toContainText("Chaos")
  await page.locator(".wordmark").click()
  expect(params(page.url())).toEqual({ quote: "Chaos", q: "Divine Orb" })
  await page.getByRole("button", { name: "Clear search", exact: true }).click()
  expect(params(page.url())).toEqual({ quote: "Chaos" })
  await quote.click()
  await page.getByRole("option", { name: "Auto", exact: true }).click()
  expect(params(page.url())).toEqual({})
  await page.goBack()
  await expect(quote).toContainText("Chaos")
})
