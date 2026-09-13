import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
const buildsURL = process.env.BUILD_TEST_URL || "/build-bin"
for (const width of [390, 1440])
  test(`build preview, section nav and tree at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(buildsURL)
    await expect(
      page.getByRole("heading", { name: "A build worth sharing." })
    ).toBeVisible()
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    await page.getByRole("button", { name: "Share", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Ready to share?" })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.locator(".build-identity h1")).toContainText("Level 90")
    // Each section's content column outweighs its stats column on wide
    // screens; on phones the two stack, so the content spans the section.
    const section = (await page.locator("#equipment").boundingBox())!.width
    const main = page.locator("#equipment .build-section-main")
    expect((await main.boundingBox())!.width).toBeGreaterThan(section * 0.6)
    const nav = page.getByRole("navigation", { name: "Build sections" })
    await expect(nav.getByRole("link")).toHaveText([
      "Equipment",
      "Skills",
      "Trees",
      "Notes",
    ])
    await expect(nav.getByRole("link", { name: "Configuration" })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("heading", { name: "Snapshot configuration" })
    ).toHaveCount(0)
    await nav.getByRole("link", { name: "Skills", exact: true }).click()
    await expect(page).toHaveURL(/#skills$/)
    await expect(
      page.getByRole("heading", { name: "Skills & supports" })
    ).toBeInViewport()
    await nav.getByRole("link", { name: "Trees", exact: true }).click()
    await expect(
      nav.getByRole("link", { name: "Trees", exact: true })
    ).toHaveAttribute("aria-current", "location")
    await expect(
      page.getByRole("img", { name: /mapped saved passive nodes/ }).first()
    ).toBeVisible()
    const jewels = page.locator(".tree-socketed-jewels")
    const keystones = page.locator(".tree-key-passives")
    const attributes = page.locator(".tree-attributes")
    await expect(jewels).toContainText("Prism of Belief")
    await expect(jewels.locator("img").first()).toBeVisible()
    // Jewels stay with the maps; keystones and attributes form the section's
    // right column on wide screens and stack below it on phones.
    const jewelsBox = (await jewels.boundingBox())!
    const keystonesBox = (await keystones.boundingBox())!
    if (width >= 1000) {
      expect(keystonesBox.x).toBeGreaterThan(jewelsBox.x + jewelsBox.width)
    } else {
      expect(jewelsBox.y).toBeLessThan(keystonesBox.y)
    }
    expect((await attributes.boundingBox())!.y).toBeGreaterThan(keystonesBox.y)
    const intelligence = attributes
      .getByRole("row")
      .filter({ hasText: "Intelligence" })
    await expect(intelligence).toContainText("5 nodes")
    await expect(intelligence).toContainText("+35")
    expect(
      await attributes.evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true)
    await page.getByRole("button", { name: "Open tree", exact: true }).click()
    await page
      .getByRole("button", { name: "Zoom in", exact: true })
      .first()
      .click()
    await page
      .getByRole("button", { name: "Reset", exact: true })
      .first()
      .click()
    await page.keyboard.press("Escape")
    await nav.getByRole("link", { name: "Notes", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: "Notes", exact: true })
    ).toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/exile-build-${width}.png`,
      fullPage: true,
    })
  })
test("invalid code can be corrected without publishing", async ({ page }) => {
  await page.goto(buildsURL)
  await page.getByLabel("PoB export or pobb.in link").fill("invalid")
  await page.getByRole("button", { name: "Preview build" }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Ready to share?" })
  ).toHaveCount(0)
})

test("valid pasted exports auto-preview and incomplete input stays editable", async ({
  page,
}) => {
  await page.goto(buildsURL)
  const input = page.getByLabel("PoB export or pobb.in link")
  await input.fill("eNrt")
  await page.waitForTimeout(650)
  await expect(input).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
  await input.fill(code)
  await expect(page.locator(".build-identity h1")).toContainText("Level 90")
  await page.getByRole("button", { name: "Share", exact: true }).click()
  await page.getByRole("button", { name: "Change export", exact: true }).click()
  await page.waitForTimeout(650)
  await expect(input).toBeVisible()
})

test("auto-preview shows checking and loading feedback without resizing the button", async ({
  page,
}) => {
  await page.goto(buildsURL)
  const button = page.locator(".build-import-submit")
  const originalWidth = (await button.boundingBox())!.width
  await button.evaluate((element) => {
    const states: {
      text: string
      width: number
      busy: string | null
      spinner: boolean
    }[] = []
    Object.assign(window, { importStates: states })
    new MutationObserver(() => {
      if (element.isConnected)
        states.push({
          text: element.textContent || "",
          width: element.getBoundingClientRect().width,
          busy: element.getAttribute("aria-busy"),
          spinner: !!element.querySelector(".animate-spin"),
        })
    }).observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
  })
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await expect(page.locator(".build-identity h1")).toContainText("Level 90")
  const states = await page.evaluate(
    () =>
      (
        window as unknown as {
          importStates: {
            text: string
            width: number
            busy: string
            spinner: boolean
          }[]
        }
      ).importStates
  )
  for (const label of ["Checking build…", "Loading build…"]) {
    const state = states.find((s) => s.text.includes(label))
    expect(state).toBeDefined()
    expect(state!.busy).toBe("true")
    expect(state!.spinner).toBe(true)
    expect(state!.width).toBe(originalWidth)
  }
})

test("legacy /builds links redirect to the Build Bin", async ({ page }) => {
  await page.goto("/builds")
  await expect(page).toHaveURL(/\/build-bin$/)
  await expect(
    page.getByRole("heading", { name: "A build worth sharing." })
  ).toBeVisible()
  const slug = "123e4567-e89b-12d3-a456-426614174000"
  await page.goto(`/builds/${slug}`)
  await expect(page).toHaveURL(new RegExp(`/build-bin/${slug}$`))
  // The slug survives the redirect; an unknown one lands on the not-found page.
  await expect(
    page.getByRole("heading", { name: "Build not found." })
  ).toBeVisible()
})
