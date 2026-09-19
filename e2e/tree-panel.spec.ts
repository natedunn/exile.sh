import { expect, test } from "@playwright/test"

for (const width of [1440, 390]) {
  test(`passive panel and shared ascendancy preference at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    const openSettings = async () => {
      if (width < 768) {
        await page
          .getByRole("button", { name: "Tree settings", exact: true })
          .click()
        await expect(
          page.locator('[data-slot="tree-settings"]').locator("..")
        ).toHaveCSS("transform", "none")
      }
    }
    const requests: string[] = []
    page.on("request", (request) => requests.push(request.url()))
    await page.goto("/trees/passive")
    await openSettings()
    const panel = page.locator('[data-slot="tree-settings"]')
    const map = page.locator('[data-slot="tree-viewport"] svg')
    await expect(map).toBeVisible()
    await expect(
      panel.getByRole("combobox", { name: "Tree version" })
    ).toContainText("0.5")
    await expect(
      panel.getByRole("combobox", { name: "Show ascendancy" })
    ).toContainText("None")
    await expect(
      page.getByRole("checkbox", { name: "Paths Not Taken" })
    ).toHaveCount(0)
    await expect(map.locator("[data-tree-center]")).toHaveCount(1)
    expect(requests.some((url) => url.includes("/ascendancies-v1/"))).toBe(
      false
    )
    expect(requests.some((url) => url.includes("/pob-trees/v4/"))).toBe(false)
    const viewport = (await page
      .locator('[data-slot="tree-viewport"]')
      .boundingBox())!
    const position = (await panel.boundingBox())!
    expect(position.x).toBeGreaterThanOrEqual(viewport.x)
    expect(position.y).toBeGreaterThanOrEqual(viewport.y)
    expect(position.width).toBeLessThanOrEqual(221)
    const ascendancySelect = panel.getByRole("combobox", {
      name: "Show ascendancy",
    })
    const initialSelectWidth = (await ascendancySelect.boundingBox())!.width
    await expect(panel.locator('[data-slot="field-label"]')).toHaveText([
      "Version",
      "Show ascendancy",
    ])
    const before = await map.getAttribute("viewBox")
    await panel.getByRole("combobox", { name: "Show ascendancy" }).click()
    await page.getByRole("option", { name: "Oracle", exact: true }).click()
    expect((await ascendancySelect.boundingBox())!.width).toBeCloseTo(
      initialSelectWidth,
      3
    )
    await expect(
      ascendancySelect.locator('[data-slot="select-value"]')
    ).toHaveText("Oracle")
    await expect(map.locator('[data-node^="center:"]').first()).toBeAttached()
    await expect(map).toHaveAttribute("viewBox", before!)
    await page.getByRole("checkbox", { name: "Paths Not Taken" }).check()
    await expect(map).toHaveAttribute("viewBox", before!)
    await page
      .getByRole("link", { name: "Ascendancy Trees", exact: true })
      .click()
    await openSettings()
    await expect(
      page.getByRole("combobox", { name: "Ascendancy", exact: true })
    ).toContainText("Oracle")
    await page
      .getByRole("combobox", { name: "Ascendancy", exact: true })
      .click()
    await page.getByRole("option", { name: "Titan", exact: true }).click()
    await page.goto("/trees/passive")
    await openSettings()
    await expect(
      panel.getByRole("combobox", { name: "Show ascendancy" })
    ).toContainText("Titan")
    await expect(map.locator('[data-node^="center:"]').first()).toBeAttached()
    await expect(
      page.getByRole("checkbox", { name: "Paths Not Taken" })
    ).toHaveCount(0)
    await panel.getByRole("combobox", { name: "Show ascendancy" }).click()
    await page.getByRole("option", { name: "None", exact: true }).click()
    await expect(map.locator('[data-node^="center:"]')).toHaveCount(0)
    await page.reload()
    await openSettings()
    await expect(
      panel.getByRole("combobox", { name: "Show ascendancy" })
    ).toContainText("None")
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight
      )
    ).toBe(false)
    await panel.getByRole("combobox", { name: "Show ascendancy" }).focus()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("listbox")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(
      panel.getByRole("combobox", { name: "Show ascendancy" })
    ).toBeFocused()
  })
}
