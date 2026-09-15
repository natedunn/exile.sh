import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import type { Page } from "@playwright/test"

const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
const buildsURL = process.env.BUILD_TEST_URL || "/build-bin"
async function preview(page: Page) {
  await page.goto(buildsURL)
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page.locator(".equipment-board").scrollIntoViewIfNeeded()
}
test("equipment artwork, hover, keyboard dismissal and weapon swap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await expect(main.locator(":scope > img")).toBeVisible()
  await expect
    .poll(() =>
      main
        .locator(":scope > img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
    )
    .toBeGreaterThan(0)
  await expect(main.locator(".gear-sockets img")).toHaveCount(2)
  await expect(main.getByAltText("Saqawal's Rune of the Sky")).toBeVisible()
  await expect
    .poll(() =>
      main
        .locator(".gear-sockets img")
        .evaluateAll((images) =>
          images.every((img) => (img as HTMLImageElement).naturalWidth > 0)
        )
    )
    .toBe(true)
  await main.hover()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(
    page.getByRole("dialog").getByText("Sanctified Staff", { exact: true })
  ).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await main.hover()
  await expect(page.getByRole("dialog")).toBeVisible()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toHaveCSS("pointer-events", "none")
  await main.click()
  await page.mouse.move(0, 0)
  await expect(dialog).not.toBeVisible()
  await main.hover()
  await expect(dialog).toBeVisible()
  await page.keyboard.down("Alt")
  await expect(dialog).toHaveCSS("pointer-events", "auto")
  await dialog.hover()
  await expect(dialog).toBeVisible()
  await page.keyboard.up("Alt")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await main.focus()
  await main.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(main).toBeFocused()
  await page.getByRole("tab", { name: "Set II", exact: true }).click()
  await expect(
    page.getByRole("button", { name: /Main hand: Hypnotic Pelt/ })
  ).toBeVisible()
  await page.getByRole("tab", { name: "Set I", exact: true }).click()
  await expect(main).toBeVisible()
})
test("touch inspection stays within a mobile viewport and can be dismissed", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await preview(page)
  const main = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await main.tap()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
  await page.screenshot({ path: "/tmp/exile-equipment-mobile.png" })
  await dialog.getByRole("button", { name: /^Pin .* item details$/ }).tap()
  await page
    .getByRole("button", { name: /^Close pinned .* item details$/ })
    .tap()
  await expect(dialog).toHaveCount(0)
  expect(
    await page
      .locator(".equipment-board")
      .evaluate((e) => e.getBoundingClientRect().right)
  ).toBeLessThanOrEqual(390)
  await context.close()
})

for (const width of [390, 1440])
  test(`unavailable weapon set explains itself on keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(buildsURL)
    const noSwap = readFileSync(
      new URL("../shared/fixtures/pob/R09ZhxGeretC.txt", import.meta.url),
      "utf8"
    )
    await page.getByLabel("PoB export or pobb.in link").fill(noSwap)
    const first = page.getByRole("tab", { name: "Set I", exact: true })
    await first.focus()
    await page.keyboard.press("Tab")
    await expect(page.locator(".equipment-weapon-switch-off")).toBeFocused()
    await expect(page.getByRole("tooltip")).toHaveText("No weapon in set 2")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("tooltip")).toHaveCount(0)
    await expect(
      page.getByRole("tab", { name: "Set II", exact: true })
    ).toBeDisabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
