import { expect, test } from "@playwright/test"

for (const width of [1440, 390]) {
  test(`passive panel and shared ascendancy preference at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    const requests: string[] = []
    page.on("request", (request) => requests.push(request.url()))
    await page.goto("/trees/passive")
    const panel = page.locator(".tree-settings-panel")
    const map = page.locator(".tree-viewport svg")
    await expect(map).toBeVisible()
    await expect(
      panel.getByRole("combobox", { name: "Tree version" })
    ).toContainText("0.5")
    await expect(
      panel.getByRole("combobox", { name: "Show ascendancy" })
    ).toContainText("None")
    await expect(page.locator(".tree-explorer-options")).toHaveCount(0)
    await expect(
      page.getByRole("checkbox", { name: "Paths Not Taken" })
    ).toHaveCount(0)
    await expect(map.locator("[data-tree-center]")).toHaveCount(1)
    expect(requests.some((url) => url.includes("/ascendancies-v1/"))).toBe(
      false
    )
    expect(requests.some((url) => url.includes("/pob-trees/v4/"))).toBe(false)
    const viewport = (await page.locator(".tree-viewport").boundingBox())!
    const position = (await panel.boundingBox())!
    expect(position.x).toBeGreaterThanOrEqual(viewport.x)
    expect(position.y).toBeGreaterThanOrEqual(viewport.y)
    expect(position.width).toBeLessThanOrEqual(220)
    const ascendancySelect = panel.getByRole("combobox", {
      name: "Show ascendancy",
    })
    const initialSelectWidth = (await ascendancySelect.boundingBox())!.width
    await expect(panel.locator(".tree-setting-label")).toHaveText([
      "Version",
      "Show ascendancy",
    ])
    const before = await map.getAttribute("viewBox")
    await panel.getByRole("combobox", { name: "Show ascendancy" }).click()
    await page.getByRole("option", { name: "Oracle", exact: true }).click()
    expect((await ascendancySelect.boundingBox())!.width).toBe(
      initialSelectWidth
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
    await expect(
      page.getByRole("combobox", { name: "Ascendancy", exact: true })
    ).toContainText("Oracle")
    await page
      .getByRole("combobox", { name: "Ascendancy", exact: true })
      .click()
    await page.getByRole("option", { name: "Titan", exact: true }).click()
    await page.goto("/trees/passive")
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
