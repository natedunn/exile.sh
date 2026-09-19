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
    await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
      "Level 90"
    )
    // Each section's content column outweighs its stats column on wide
    // screens; on phones the two stack, so the content spans the section.
    const section = (await page.locator("#equipment").boundingBox())!.width
    const main = page.locator("#equipment [data-slot=build-section-main]")
    expect((await main.boundingBox())!.width).toBeGreaterThan(section * 0.6)
    const nav = page.getByRole("navigation", { name: "Build sections" })
    await expect(nav.getByRole("list").getByRole("link")).toHaveText([
      "Equipment",
      "Skills",
      "Trees",
      "Jewels",
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
    const keystones = page.locator('[data-slot="tree-key-passives"]')
    const attributes = page.locator('[data-slot="tree-attributes"]')
    const keystonesBox = (await keystones.boundingBox())!
    expect((await attributes.boundingBox())!.y).toBeGreaterThan(keystonesBox.y)
    // Jewels have a section of their own below the trees, with the stats
    // they add up to beside them.
    const jewels = page.locator("#jewels")
    await expect(jewels).toContainText("Prism of Belief")
    await expect(
      jewels.locator('[data-slot="jewel-art"] img').first()
    ).toBeVisible()
    await expect(jewels).toContainText("49% increased Presence Area of Effect")
    expect((await jewels.boundingBox())!.y).toBeGreaterThan(
      (await page.locator("#tree").boundingBox())!.y
    )
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
    const backToTop = nav.getByTitle("Back to top", { exact: true })
    await expect(backToTop).toHaveAttribute("href", "#")
    await backToTop.focus()
    await backToTop.press("Enter")
    await expect(page).toHaveURL((url) => url.hash === "")
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(
      page.locator("[data-testid=build-identity] h1")
    ).toBeInViewport()
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
  await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
    "Level 90"
  )
  await page.getByRole("button", { name: "Share", exact: true }).click()
  await page.getByRole("button", { name: "Change export", exact: true }).click()
  await page.waitForTimeout(650)
  await expect(input).toBeVisible()
})

test("auto-preview shows checking and loading feedback without resizing the button", async ({
  page,
}) => {
  await page.goto(buildsURL)
  const button = page.locator("[data-testid=build-import-submit]")
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
  await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
    "Level 90"
  )
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

test("a shared build keeps its selected sets in the URL", async ({ page }) => {
  await page.goto(buildsURL)
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
    "Level 90"
  )
  // The unsaved preview keeps its selection to itself.
  await page.getByRole("tab", { name: "Set II", exact: true }).click()
  expect(new URL(page.url()).search).toBe("")
  await page.getByRole("button", { name: "Share", exact: true }).click()
  await page.getByRole("button", { name: "Create share link" }).click()
  await expect(page).toHaveURL(/\/build-bin\/[0-9a-f-]{36}$/)
  const shared = new URL(page.url()).pathname
  await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
    "Level 90"
  )
  const setTwo = page.getByRole("tab", { name: "Set II", exact: true })
  const tree = page.getByRole("combobox", {
    name: "Tree specification",
    exact: true,
  })
  await setTwo.click()
  await expect(page).toHaveURL(/\?weapons=swap$/)
  await tree.click()
  await page.getByRole("option").nth(1).click()
  await expect(page).toHaveURL(/weapons=swap/)
  await expect(page).toHaveURL(/tree=1/)
  const secondSpec = await tree.innerText()
  await page.reload({ waitUntil: "networkidle" })
  await expect(setTwo).toHaveAttribute("aria-selected", "true")
  await expect(tree).toContainText(secondSpec)
  // Selecting the build's own active set drops the parameter again.
  await page.getByRole("tab", { name: "Set I", exact: true }).click()
  await expect(page).not.toHaveURL(/weapons=/)
  await expect(page).toHaveURL(/tree=1/)
  // Unknown values fall back to the saved selection instead of a blank view.
  await page.goto(`${shared}?tree=99&weapons=nonsense`)
  await expect(
    page.getByRole("tab", { name: "Set I", exact: true })
  ).toHaveAttribute("aria-selected", "true")
  await expect(
    page.getByRole("img", { name: /mapped saved passive nodes/ }).first()
  ).toBeVisible()
})

test("section navigation restores initial hashes and Back/Forward destinations", async ({
  page,
}) => {
  await page.goto(`${buildsURL}#skills`)
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  const nav = page.getByRole("navigation", { name: "Build sections" })
  const skills = page.getByRole("heading", { name: "Skills & supports" })
  await expect(skills).toBeInViewport()
  await nav.getByRole("link", { name: "Equipment", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true })
  ).toBeInViewport()
  await nav.getByRole("link", { name: "Notes", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true })
  ).toBeInViewport()
  await page.goBack()
  await expect(page).toHaveURL(/#equipment$/)
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true })
  ).toBeInViewport()
  await page.goBack()
  await expect(page).toHaveURL(/#skills$/)
  await expect(skills).toBeInViewport()
  await page.goForward()
  await expect(page).toHaveURL(/#equipment$/)
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true })
  ).toBeInViewport()
})

for (const width of [390, 1440])
  test(`Equipment anchor keeps the sticky identity and links stable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(buildsURL)
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    const nav = page.getByRole("navigation", { name: "Build sections" })
    await expect(nav).not.toHaveAttribute("data-pinned")
    const equipment = nav.getByRole("link", { name: "Equipment", exact: true })
    await equipment.click()
    await expect(nav).toHaveAttribute("data-pinned", "true")
    await expect(
      nav.locator("[data-testid=build-nav-identity-reveal]")
    ).toHaveCSS("opacity", "1")
    // Finish the reveal before comparing link positions across section jumps.
    await expect
      .poll(() =>
        nav
          .locator("[data-testid=build-nav-identity-reveal]")
          .evaluate((el) => getComputedStyle(el).transform)
      )
      .toBe("matrix(1, 0, 0, 1, 0, 0)")
    const initialX = (await equipment.boundingBox())!.x
    for (const section of ["Skills", "Notes"]) {
      await nav.getByRole("link", { name: section, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#${section.toLowerCase()}$`))
      await expect
        .poll(() =>
          page
            .locator(`#${section.toLowerCase()}`)
            .evaluate((el) =>
              Math.abs(
                Math.min(
                  el.getBoundingClientRect().top +
                    window.scrollY -
                    parseFloat(getComputedStyle(el).scrollMarginTop),
                  document.documentElement.scrollHeight - window.innerHeight
                ) - window.scrollY
              )
            )
        )
        .toBeLessThan(2)
      const stayedVisible = nav.evaluate(
        (el) =>
          new Promise<boolean>((resolve) => {
            let visible = el.hasAttribute("data-pinned")
            const observer = new MutationObserver(() => {
              visible &&= el.hasAttribute("data-pinned")
            })
            observer.observe(el, {
              attributes: true,
              attributeFilter: ["data-pinned"],
            })
            setTimeout(() => {
              observer.disconnect()
              resolve(visible)
            }, 700)
          })
      )
      await equipment.click()
      expect(await stayedVisible).toBe(true)
      await expect
        .poll(() =>
          page
            .locator("#equipment")
            .evaluate((el) =>
              Math.abs(
                Math.min(
                  el.getBoundingClientRect().top +
                    window.scrollY -
                    parseFloat(getComputedStyle(el).scrollMarginTop),
                  document.documentElement.scrollHeight - window.innerHeight
                ) - window.scrollY
              )
            )
        )
        .toBeLessThan(2)
      await expect(nav).toHaveAttribute("data-pinned", "true")
      await expect
        .poll(async () => (await equipment.boundingBox())!.x)
        .toBeCloseTo(initialX, 0)
    }
    const stop = await page.evaluate(() => window.scrollY)
    await page.evaluate((y) => window.scrollTo(0, y - 2), stop)
    await expect(nav).not.toHaveAttribute("data-pinned")
    await page.evaluate((y) => window.scrollTo(0, y), stop)
    await expect(nav).toHaveAttribute("data-pinned", "true")
    await nav.getByRole("link", { name: "Go to top", exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(nav).not.toHaveAttribute("data-pinned")
    await expect(
      nav.locator("[data-testid=build-nav-identity-reveal]")
    ).toHaveCSS("opacity", "0")
  })
