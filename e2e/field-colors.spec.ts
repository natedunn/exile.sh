import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

test("shared fields keep a distinct, consistent fill across pages and focus states", async ({
  page,
}) => {
  await page.goto("/build-bin")
  const source = page.getByLabel("PoB export or pobb.in link")
  await expect(source).toBeEnabled()
  const colors = await source.evaluate((element) => {
    const probe = document.createElement("span")
    document.body.append(probe)
    const resolve = (token: string) => {
      probe.style.backgroundColor = `var(${token})`
      return getComputedStyle(probe).backgroundColor
    }
    const result = {
      field: resolve("--color-field"),
      surface: resolve("--color-surface"),
      muted: resolve("--color-ink-muted"),
      ink: resolve("--color-ink"),
    }
    probe.remove()
    return result
  })
  await expect(source).toHaveCSS("background-color", colors.field)
  expect(colors.field).not.toBe(colors.surface)
  await expect(source.locator("xpath=ancestor::section[1]")).toHaveCSS(
    "background-color",
    colors.surface
  )
  await expect(page.locator('label[for="pob-source"]')).toHaveCSS(
    "color",
    colors.ink
  )
  expect(
    await source.evaluate((e) => getComputedStyle(e, "::placeholder").color)
  ).toBe(colors.muted)
  await source.focus()
  await expect(source).toHaveCSS("background-color", colors.field)
  await source.fill(
    readFileSync(
      new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
      "utf8"
    )
  )
  await page.getByRole("button", { name: "Share", exact: true }).click()
  await expect(
    page.locator('[data-slot="dialog-content"] [data-slot="input"]')
  ).toHaveCSS("background-color", colors.field)

  for (const route of ["/economy/market", "/trees/passive"]) {
    await page.goto(route)
    if (route === "/trees/passive")
      await page
        .getByRole("button", { name: "Search tree", exact: true })
        .click()
    const input = page.getByRole("textbox", {
      name: route === "/trees/passive" ? "Search nodes" : "Search currencies",
      exact: true,
    })
    await expect(input).toBeVisible()
    const group = page
      .locator('[data-slot="input-group"]')
      .filter({ has: input })
    await expect(group).toHaveCSS("background-color", colors.field)
    await expect(input).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    expect(
      await input.evaluate((e) => getComputedStyle(e, "::placeholder").color)
    ).toBe(colors.muted)
    await input.focus()
    await expect(group).toHaveCSS("background-color", colors.field)
    for (const select of await page
      .locator('[data-slot="select-trigger"]:visible')
      .all())
      await expect(select).toHaveCSS("background-color", colors.field)
  }
})
