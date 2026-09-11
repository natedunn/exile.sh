import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
test("tree preserves geometry and supports inspection, zoom, pan and dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto(process.env.BUILD_TEST_URL || "http://localhost:3000/builds")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page.getByRole("tab", { name: "Tree", exact: true }).click()
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const map = page.locator(".tree-fullscreen .tree-viewport svg")
  await expect(map).toBeVisible()
  await map.scrollIntoViewIfNeeded()
  const mapWidth = (await map.boundingBox())!.width
  expect(mapWidth).toBeGreaterThan(1400)
  expect(await map.locator(".tree-passive-art").count()).toBe(0)
  const original = await map.getAttribute("viewBox")
  await map.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(map).not.toHaveAttribute("viewBox", original!)
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  expect(await map.locator("path[d*='A']").count()).toBeGreaterThan(100)
  const node = map.locator("[data-node]").nth(100)
  await node.hover()
  await expect(page.locator(".tree-inspection")).toBeVisible()
  // Switch anchors without closing the popup: its position must follow its content.
  const candidates = await map.locator("[data-node]").evaluateAll((elements) =>
    elements
      .map((element) => {
        const box = element.getBoundingClientRect()
        return {
          id: element.getAttribute("data-node"),
          x: box.x + box.width / 2,
          y: box.y,
        }
      })
      .filter(
        (n) =>
          n.x > 220 &&
          n.x < innerWidth - 220 &&
          n.y > 300 &&
          n.y < innerHeight - 100
      )
  )
  const first = candidates[0]
  const second = candidates.find((n) => Math.abs(n.x - first.x) > 200)!
  expect(second).toBeDefined()
  for (const candidate of [first, second, first]) {
    await map.locator('[data-node="' + candidate.id + '"]').hover()
    await expect
      .poll(async () => {
        const box = await page.locator(".tree-inspection").boundingBox()
        return Math.abs(box!.x + box!.width / 2 - candidate.x)
      })
      .toBeLessThan(3)
  }
  await node.hover()
  await expect(page.locator(".tree-inspection")).toHaveCSS(
    "pointer-events",
    "none"
  )
  await expect(page.locator(".tree-inspection")).toHaveCSS(
    "user-select",
    "none"
  )
  await page.keyboard.down("Alt")
  await page.mouse.move(0, 0)
  await expect(page.locator(".tree-inspection")).toBeVisible()
  await expect(page.locator(".tree-inspection")).toHaveCSS(
    "pointer-events",
    "auto"
  )
  await expect(page.locator(".tree-inspection")).toHaveCSS(
    "user-select",
    "text"
  )
  await page.keyboard.up("Alt")
  await expect(page.locator(".tree-inspection")).toHaveCount(0)
  const rect = (await map.boundingBox())!
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.wheel(0, -300)
  await expect(map).not.toHaveAttribute("viewBox", original!)
  await page
    .getByRole("button", { name: "Zoom in", exact: true })
    .first()
    .click()
  await page
    .getByRole("button", { name: "Zoom in", exact: true })
    .first()
    .click()
  await expect
    .poll(() => map.locator(".tree-passive-art").count())
    .toBeGreaterThan(0)
  await expect(map.locator(".tree-passive-art").first()).toHaveAttribute(
    "clip-path",
    /url\(#.+\)/
  )
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  const zoomed = await map.getAttribute("viewBox")
  await page.mouse.down()
  await page.mouse.move(
    rect.x + rect.width / 2 + 100,
    rect.y + rect.height / 2 + 70,
    { steps: 5 }
  )
  await page.mouse.up()
  await expect(map).not.toHaveAttribute("viewBox", zoomed!)
  await map.focus()
  await page.keyboard.press("Enter")
  await expect(page.locator(".tree-inspection")).toBeVisible()
  await page.mouse.move(0, 0)
  await map.press("Escape")
  await expect(page.locator(".tree-inspection")).toHaveCount(0)
  await expect(page.locator(".tree-fullscreen")).toHaveCount(0)
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  await page.getByRole("button", { name: "Reset", exact: true }).first().click()
  await expect(map).toHaveAttribute("viewBox", original!)
})
test("tree node tap works at mobile widths", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.goto(process.env.BUILD_TEST_URL || "http://localhost:3000/builds")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page.getByRole("tab", { name: "Tree", exact: true }).click()
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const map = page.locator(".tree-fullscreen .tree-viewport svg")
  await expect(map).toBeVisible()
  await map.locator("[data-node]").nth(100).tap()
  await expect(page.locator(".tree-inspection")).toBeVisible()
  const card = (await page.locator(".tree-inspection").boundingBox())!
  expect(card.x).toBeGreaterThanOrEqual(0)
  expect(card.x + card.width).toBeLessThanOrEqual(390)
  await map.tap({ position: { x: 8, y: 8 } })
  await expect(page.locator(".tree-inspection")).toHaveCount(0)
  await context.close()
})

test("From Nothing radius and socketed jewel details render from a real export", async ({
  page,
}) => {
  const fromNothing = readFileSync(
    new URL("../shared/fixtures/pob/Mu3PxErdMKiE.txt", import.meta.url),
    "utf8"
  )
  await page.goto(process.env.BUILD_TEST_URL || "http://localhost:3000/builds")
  await page.getByLabel("PoB export or pobb.in link").fill(fromNothing)
  await page.getByRole("tab", { name: "Tree", exact: true }).click()
  await expect(page.locator('[data-jewel-radius="From Nothing"]')).toHaveCount(
    1
  )
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  // Weapon set passives are marked, and the palette toggle applies to the map.
  await expect(
    page.locator('.tree-fullscreen [data-node][data-weapon-set="1"]')
  ).toHaveCount(24)
  await expect(
    page.locator('.tree-fullscreen [data-node][data-weapon-set="2"]')
  ).toHaveCount(22)
  const palette = page.getByRole("combobox", { name: "Weapon set palette" })
  await expect(
    page.locator(".tree-fullscreen .passive-tree")
  ).not.toHaveAttribute("data-palette", /./)
  await palette.click()
  await page
    .getByRole("option", { name: "Tritanopia (blue-weak)", exact: true })
    .click()
  await expect(page.locator(".tree-fullscreen .passive-tree")).toHaveAttribute(
    "data-palette",
    "tritan"
  )
  await palette.click()
  await page
    .getByRole("option", { name: "Standard colours", exact: true })
    .click()
  await page.locator('.tree-fullscreen [data-node="61419"]').hover()
  await expect(page.locator(".tree-inspection")).toContainText("From Nothing")
  await expect(page.locator(".tree-inspection")).toContainText(
    "Eldritch Battery"
  )
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("heading", { name: "Socketed jewels", exact: true })
  ).toBeVisible()
})

test("compact tree overview and share dialog preserve page ergonomics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/builds")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await expect(page.locator(".build-identity h1")).toContainText("Level")
  await expect(
    page.getByRole("heading", { name: "Ready to share?" })
  ).toHaveCount(0)
  const share = page.getByRole("button", { name: "Share", exact: true })
  await share.click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Build title")).toHaveValue(/Level/)
  await page.keyboard.press("Escape")
  await expect(share).toBeFocused()
  await page.getByRole("tab", { name: "Tree", exact: true }).click()
  const preview = page.locator(".tree-preview svg")
  await expect(preview).toBeVisible()
  const box = (await preview.boundingBox())!
  const passives = (await page.locator(".tree-key-passives").boundingBox())!
  expect(passives.x).toBeGreaterThan(box.x + box.width)
  const initial = await preview.getAttribute("viewBox")
  const open = page.getByRole("button", { name: "Open tree", exact: true })
  await open.hover()
  await page.mouse.wheel(0, 120)
  await expect(preview).toHaveAttribute("viewBox", initial!)
  await open.click()
  await expect(page.locator(".tree-fullscreen")).toBeVisible()
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(open).toBeFocused()
  await expect(
    page.locator('[data-mode="ascendancy"] .tree-passive-art').first()
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const mobilePreview = (await preview.boundingBox())!
  const mobilePassives = (await page
    .locator(".tree-key-passives")
    .boundingBox())!
  expect(mobilePassives.y).toBeGreaterThan(
    mobilePreview.y + mobilePreview.height
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})

test("all palettes recolor shared and weapon nodes consistently and persist on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const source = readFileSync(
    new URL("../shared/fixtures/pob/Mu3PxErdMKiE.txt", import.meta.url),
    "utf8"
  )
  async function openBuild() {
    await page.goto("/builds")
    await page.getByLabel("PoB export or pobb.in link").fill(source)
    await page.getByRole("tab", { name: "Tree", exact: true }).click()
    await page.getByRole("button", { name: "Open tree", exact: true }).click()
  }
  await openBuild()
  const map = page.locator(".tree-fullscreen .passive-tree")
  const picker = page.getByRole("combobox", { name: "Weapon set palette" })
  let standard = ""
  for (const [value, label] of [
    ["default", "Standard colours"],
    ["deutan", "Deuteranopia (green-weak)"],
    ["protan", "Protanopia (red-weak)"],
    ["tritan", "Tritanopia (blue-weak)"],
    ["achroma", "Achromatopsia (no colour)"],
  ]) {
    await picker.click()
    await page.getByRole("option", { name: label, exact: true }).click()
    await expect(picker).toContainText(label)
    const colors = await map.evaluate((element) => {
      const shared = element.querySelector(
        '[data-node][fill="var(--color-tree-allocated)"]'
      )!
      const first = element.querySelector('[data-node][data-weapon-set="1"]')!
      const second = element.querySelector('[data-node][data-weapon-set="2"]')!
      return {
        nodes: [shared, first, second].map((n) => getComputedStyle(n).fill),
        legend: [...element.querySelectorAll(".tree-legend li")].map(
          (n) => getComputedStyle(n, "::before").backgroundColor
        ),
      }
    })
    expect(colors.nodes).toEqual(colors.legend)
    expect(new Set(colors.nodes).size).toBe(3)
    if (value === "default") standard = colors.nodes[0]
    else expect(colors.nodes[0]).not.toBe(standard)
    await expect(map.locator(".tree-legend")).toBeVisible()
    const pickerSize = await picker.boundingBox()
    expect(pickerSize!.x + pickerSize!.width).toBeLessThanOrEqual(390)
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("exile.tree.palette"))
      )
      .toBe(value)
  }
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page.locator(".tree-preview .passive-tree")).toHaveAttribute(
    "data-palette",
    "achroma"
  )
  await openBuild()
  await expect(map).toHaveAttribute("data-palette", "achroma")
  await expect(picker).toContainText("Achromatopsia (no colour)")
})
