import { expect, test } from "@playwright/test"

for (const width of [1440, 390, 320]) {
  for (const [route, query] of [
    ["passive", "strength"],
    ["ascendancies", "damage"],
    ["atlas", "waystone"],
  ]) {
    test(`search ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`/trees/${route}`)
      const search = page.getByRole("button", {
        name: "Search tree",
        exact: true,
      })
      await expect(search).toBeVisible()
      if (width < 768 && route !== "atlas") {
        await expect(
          page.getByRole("button", { name: "Tree settings", exact: true })
        ).toHaveAttribute("aria-expanded", "false")
        await page
          .getByRole("button", { name: "Tree settings", exact: true })
          .click()
        await expect(
          page.getByRole("button", { name: "Close tree settings" })
        ).toBeVisible()
      }
      await page.locator(".tree-viewport svg").focus()
      await page.keyboard.press("f")
      const input = page.getByRole("textbox", { name: "Search nodes" })
      await expect(input).toBeFocused()
      if (width < 768 && route !== "atlas")
        await expect(
          page.getByRole("button", { name: "Tree settings", exact: true })
        ).toHaveAttribute("aria-expanded", "false")
      await input.fill(query)
      await expect(page.getByRole("status")).not.toHaveText("Searching…")
      const matches = page.locator("[data-search-match-count]")
      await expect(matches.first()).toBeAttached()
      const results = page.locator(".tree-search-results button")
      await expect(results.first()).toBeVisible()
      await expect(results.first().locator("img")).toBeVisible()
      await expect
        .poll(() =>
          results
            .first()
            .locator("img")
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
            )
        )
        .toBe(true)
      await expect(page.locator(".tree-search-highlights")).toHaveCSS(
        "animation-name",
        "tree-search-pulse"
      )
      await expect
        .poll(async () => {
          const box = (await page.locator(".tree-search-panel").boundingBox())!
          return box.x >= 0 && box.x + box.width <= width
        })
        .toBe(true)
      await input.press("f")
      await expect(input).toHaveValue(query + "f")
      await input.fill(query)
      await expect(page.getByRole("status")).not.toHaveText("Searching…")
      await input.press("Escape")
      await expect(search).toBeFocused()
      await expect(input).not.toBeVisible()
      await expect(matches.first()).toBeAttached()
      await search.click()
      await expect(input).toHaveValue(query)
      await input.press("ArrowDown")
      await expect(page.locator('[data-result-index="0"]')).toBeFocused()
      await page.keyboard.press("End")
      const total = Number(
        await page
          .locator(".tree-search-results")
          .getAttribute("data-result-count")
      )
      await expect(
        page.locator(`[data-result-index="${total - 1}"]`)
      ).toBeFocused()
      await expect
        .poll(async () => {
          const row = (await page
            .locator(`[data-result-index="${total - 1}"]`)
            .boundingBox())!
          const list = (await page
            .locator(".tree-search-results")
            .boundingBox())!
          return row.y + row.height <= list.y + list.height + 1
        })
        .toBe(true)
      await page.keyboard.press("Home")
      await expect(page.locator('[data-result-index="0"]')).toBeFocused()
      await page.keyboard.press("ArrowDown")
      await expect(page.locator('[data-result-index="1"]')).toBeFocused()
      await page.keyboard.press("Enter")
      if (width < 768) {
        await expect(input).not.toBeVisible()
        await search.click()
      } else {
        await expect(input).toBeVisible()
        await expect(page.locator('[data-result-index="1"]')).toBeFocused()
      }
      await expect(matches.first()).toBeAttached()
      await page.locator('[data-result-index="0"]').click()
      if (width < 768) {
        await expect(input).not.toBeVisible()
        await search.click()
      } else {
        await expect(input).toBeVisible()
      }
      await page.getByRole("button", { name: "Clear search" }).click()
      await expect(matches).toHaveCount(0)
      await page.emulateMedia({ reducedMotion: "reduce" })
      await input.fill(query)
      await expect(page.getByRole("status")).not.toHaveText("Searching…")
      await expect(page.locator(".tree-search-highlights")).toHaveCSS(
        "animation-name",
        "none"
      )
      await input.fill("nonexistent-node-xyz")
      await expect(page.getByRole("status")).toHaveText("0 matching nodes")
      await page.getByRole("button", { name: "Close tree search" }).click()
      await expect(input).not.toBeVisible()
    })
  }
}

test("broad searches keep rendering bounded and keyboard navigation reaches every result", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  await page.getByRole("button", { name: "Search tree", exact: true }).click()
  const input = page.getByRole("textbox", { name: "Search nodes" })
  await input.pressSequentially("increased", { delay: 10 })
  const list = page.locator(".tree-search-results")
  await expect(page.getByRole("status")).toHaveText(/\d+ matching nodes/)
  const count = Number(await list.getAttribute("data-result-count"))
  expect(count).toBeGreaterThan(1000)
  expect(await list.locator("button").count()).toBeLessThan(40)
  await expect(page.locator(".tree-search-highlights path")).toHaveCount(3)
  await input.press("ArrowDown")
  await page.keyboard.press("End")
  const last = list.locator(`[data-result-index="${count - 1}"]`)
  await expect(last).toBeFocused()
  await expect
    .poll(async () => {
      const row = (await last.boundingBox())!
      const bounds = (await list.boundingBox())!
      return (
        row.y >= bounds.y - 1 &&
        row.y + row.height <= bounds.y + bounds.height + 1
      )
    })
    .toBe(true)
  expect(await list.locator("button").count()).toBeLessThan(40)
  await input.fill("no-matching-node-xyz")
  await expect(page.getByRole("status")).toHaveText("0 matching nodes")
  await expect(page.locator(".tree-search-highlights")).toHaveCount(0)
  await input.fill("increased")
  await input.fill("")
  await expect(page.getByRole("status")).toHaveText(
    "Search names and stats across this tree."
  )
  await expect(page.locator(".tree-search-highlights")).toHaveCount(0)
})
