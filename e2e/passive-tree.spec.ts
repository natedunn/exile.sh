import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { parseBuild } from "../shared/pob"
const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)

test("fullscreen tree stays within the viewport on desktop and mobile", async ({
  page,
}) => {
  await page.goto(process.env.BUILD_TEST_URL || "/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  const open = page.getByRole("button", { name: "Open tree", exact: true })
  const dialog = page.getByRole("dialog", { name: "Passive tree", exact: true })
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await open.click()
    await expect(dialog).toBeVisible()
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox()
        return (
          box &&
          Object.fromEntries(
            Object.entries(box).map(([key, value]) => [key, Math.round(value)])
          )
        )
      })
      .toEqual({ x: 0, y: 0, ...viewport })
    await expect(
      dialog.getByRole("heading", { name: "Passive tree" })
    ).toBeInViewport()
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true })
    ).toBeInViewport()
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(open).toBeFocused()
  }
})

test("tree preserves geometry and supports inspection, zoom, pan and dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto(process.env.BUILD_TEST_URL || "/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const map = page.locator(
    '[data-tree-fullscreen] [data-slot="tree-viewport"] svg'
  )
  await expect(map).toBeVisible()
  await map.scrollIntoViewIfNeeded()
  const mapWidth = (await map.boundingBox())!.width
  expect(mapWidth).toBeGreaterThan(1400)
  expect(await map.locator("[data-tree-art-region] image").count()).toBe(0)
  const original = await map.getAttribute("viewBox")
  await map.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(map).not.toHaveAttribute("viewBox", original!)
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  const arcCount = await map
    .locator("path[d]")
    .evaluateAll((paths) =>
      paths.reduce(
        (count, path) =>
          count + (path.getAttribute("d")?.match(/\bA\b/g)?.length ?? 0),
        0
      )
    )
  expect(arcCount).toBeGreaterThan(100)
  expect(
    await map.locator("path[data-connection-style]").count()
  ).toBeLessThanOrEqual(11)
  const node = map.locator("[data-node]").nth(100)
  await node.hover()
  await expect(page.locator('[data-inspection-tooltip="true"]')).toBeVisible()
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
        const box = await page
          .locator('[data-inspection-tooltip="true"]')
          .boundingBox()
        return Math.abs(box!.x + box!.width / 2 - candidate.x)
      })
      .toBeLessThan(3)
  }
  await node.hover()
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCSS(
    "pointer-events",
    "none"
  )
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCSS(
    "user-select",
    "none"
  )
  await page.keyboard.down("Alt")
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-inspection-tooltip="true"]')).toBeVisible()
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCSS(
    "pointer-events",
    "auto"
  )
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCSS(
    "user-select",
    "text"
  )
  await page.keyboard.up("Alt")
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCount(0)
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
    .poll(() => map.locator("[data-tree-art-region] image").count())
    .toBeGreaterThan(0)
  await expect(
    map.locator("[data-tree-art-region] image").first()
  ).toHaveAttribute("clip-path", /url\(#.+\)/)
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
  await expect(page.locator('[data-inspection-tooltip="true"]')).toBeVisible()
  await page.mouse.move(0, 0)
  await map.press("Escape")
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCount(0)
  await expect(page.locator("[data-tree-fullscreen]")).toHaveCount(0)
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
  await page.goto(process.env.BUILD_TEST_URL || "/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const map = page.locator(
    '[data-tree-fullscreen] [data-slot="tree-viewport"] svg'
  )
  await expect(map).toBeVisible()
  await map.locator("[data-node]").nth(100).tap()
  await expect(page.locator('[data-inspection-tooltip="true"]')).toBeVisible()
  const card = (await page
    .locator('[data-inspection-tooltip="true"]')
    .boundingBox())!
  expect(card.x).toBeGreaterThanOrEqual(0)
  expect(card.x + card.width).toBeLessThanOrEqual(390)
  await map.tap({ position: { x: 8, y: 8 } })
  await expect(page.locator('[data-inspection-tooltip="true"]')).toHaveCount(0)
  await context.close()
})

test("From Nothing radius and socketed jewel details render from a real export", async ({
  page,
}) => {
  const fromNothing = readFileSync(
    new URL("../shared/fixtures/pob/Mu3PxErdMKiE.txt", import.meta.url),
    "utf8"
  )
  await page.goto(process.env.BUILD_TEST_URL || "/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(fromNothing)
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  await expect(page.locator('[data-jewel-radius="From Nothing"]')).toHaveCount(
    1
  )
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  // Weapon set passives remain marked; the Build Bin hides the palette picker.
  await expect(
    page.locator('[data-tree-fullscreen] [data-node][data-weapon-set="1"]')
  ).toHaveCount(24)
  await expect(
    page.locator('[data-tree-fullscreen] [data-node][data-weapon-set="2"]')
  ).toHaveCount(22)
  const palette = page.getByRole("combobox", { name: "Color vision" })
  await expect(
    page.locator("[data-tree-fullscreen] [data-passive-tree]")
  ).not.toHaveAttribute("data-palette", /./)
  await expect(palette).toHaveCount(0)
  await page.locator('[data-tree-fullscreen] [data-node="61419"]').hover()
  await expect(page.locator('[data-inspection-tooltip="true"]')).toContainText(
    "From Nothing"
  )
  await expect(page.locator('[data-inspection-tooltip="true"]')).toContainText(
    "Eldritch Battery"
  )
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("heading", { name: "Jewels", exact: true })
  ).toBeVisible()
})

test("compact tree overview and share dialog preserve page ergonomics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await expect(page.locator("[data-testid=build-identity] h1")).toContainText(
    "Level"
  )
  await expect(
    page.getByRole("heading", { name: "Ready to share?" })
  ).toHaveCount(0)
  const share = page.getByRole("button", { name: "Share", exact: true })
  await share.click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Build title")).toHaveValue(/Level/)
  await page.keyboard.press("Escape")
  await expect(share).toBeFocused()
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  const preview = page.locator('[data-slot="tree-preview"] svg')
  await expect(preview).toBeVisible()
  const box = (await preview.boundingBox())!
  const passives = (await page
    .locator('[data-slot="tree-key-passives"]')
    .boundingBox())!
  expect(passives.x).toBeGreaterThan(box.x + box.width)
  const initial = await preview.getAttribute("viewBox")
  const open = page.getByRole("button", { name: "Open tree", exact: true })
  await open.hover()
  await page.mouse.wheel(0, 120)
  await expect(preview).toHaveAttribute("viewBox", initial!)
  await open.click()
  await expect(page.locator("[data-tree-fullscreen]")).toBeVisible()
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(open).toBeFocused()
  await expect(
    page
      .locator('[data-mode="ascendancy"] [data-tree-art-region] image')
      .first()
  ).toBeVisible()
  await expect(
    page
      .locator('[data-mode="ascendancy"] [data-ascendancy-background]')
      .first()
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole("combobox", { name: "Ascendancy", exact: true })
  ).toHaveCount(0)
  const mobilePreview = (await preview.boundingBox())!
  const mobilePassives = (await page
    .locator('[data-slot="tree-key-passives"]')
    .boundingBox())!
  expect(mobilePassives.y).toBeGreaterThan(
    mobilePreview.y + mobilePreview.height
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})

test("saved palettes recolor shared and weapon nodes with the Build Bin picker hidden", async ({
  page,
}) => {
  // Re-import and render the complete build for each of the five palettes.
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const source = readFileSync(
    new URL("../shared/fixtures/pob/Mu3PxErdMKiE.txt", import.meta.url),
    "utf8"
  )
  async function openBuild() {
    await page.goto("/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(source)
    await page
      .getByRole("navigation", { name: "Build sections" })
      .getByRole("link", { name: "Trees", exact: true })
      .click()
    await page.getByRole("button", { name: "Open tree", exact: true }).click()
  }
  await openBuild()
  const map = page.locator("[data-tree-fullscreen] [data-passive-tree]")
  const picker = page.getByRole("combobox", { name: "Color vision" })
  let standard = ""
  for (const [value] of [
    ["default", "Standard colours"],
    ["deutan", "Deuteranopia (green-weak)"],
    ["protan", "Protanopia (red-weak)"],
    ["tritan", "Tritanopia (blue-weak)"],
    ["achroma", "Achromatopsia (no colour)"],
  ]) {
    await page.evaluate(
      (palette) => localStorage.setItem("exile.tree.palette", palette),
      value
    )
    await openBuild()
    await expect(picker).toHaveCount(0)
    const colors = await map.evaluate((element) => {
      const shared = element.querySelector('[data-node-fill="allocated"]')!
      const first = element.querySelector('[data-node-fill="weapon-1"]')!
      const second = element.querySelector('[data-node-fill="weapon-2"]')!
      return {
        nodes: [shared, first, second].map((n) => getComputedStyle(n).fill),
        legend: [
          ...element.querySelectorAll('[data-slot="tree-legend"] li'),
        ].map((n) => getComputedStyle(n, "::before").backgroundColor),
      }
    })
    expect(colors.nodes).toEqual(colors.legend)
    expect(new Set(colors.nodes).size).toBe(3)
    if (value === "default") standard = colors.nodes[0]
    else expect(colors.nodes[0]).not.toBe(standard)
    await expect(map.locator('[data-slot="tree-legend"]')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("exile.tree.palette"))
      )
      .toBe(value)
  }
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(
    page.locator('[data-slot="tree-preview"] [data-passive-tree]')
  ).toHaveAttribute("data-palette", "achroma")
  await openBuild()
  await expect(map).toHaveAttribute("data-palette", "achroma")
  await expect(picker).toHaveCount(0)
})

test("Build Bin embeds its fixed ascendancy and retains center allocations", async ({
  page,
}) => {
  const build = parseBuild(code)
  const spec = build.treeSpecs[build.activeSpec]
  const ascendancy = JSON.parse(
    readFileSync(
      `public/pob-trees/ascendancies-v1/${spec.version}/shaman.json`,
      "utf8"
    )
  ) as { nodes: { id: string; baseId?: string; start: boolean }[] }
  const allocated = ascendancy.nodes.find(
    (node) => !node.start && spec.nodes.includes(node.baseId ?? node.id)
  )!
  expect(allocated).toBeTruthy()
  await page.addInitScript(() =>
    localStorage.setItem("exile.tree.ascendancy", "Oracle")
  )
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page
    .getByRole("navigation", { name: "Build sections" })
    .getByRole("link", { name: "Trees", exact: true })
    .click()
  await expect(
    page.locator('[data-slot="tree-preview"] [data-node^="center:"]').first()
  ).toBeAttached()
  await expect(page.getByRole("combobox", { name: /ascendancy/i })).toHaveCount(
    0
  )
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const map = page.locator(
    '[data-tree-fullscreen] [data-slot="tree-viewport"] svg'
  )
  await expect(map.locator('[data-node^="center:"]')).toHaveCount(
    ascendancy.nodes.filter((node) => !node.start).length
  )
  await expect(page.getByRole("combobox", { name: /ascendancy/i })).toHaveCount(
    0
  )
  const background = map.locator('image[href^="/pob-trees/ascendancy-v1/"]')
  await expect(background).toHaveCount(0)
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(background).toHaveCount(1)
  await map.locator(`[data-node="center:${allocated.id}"]`).hover()
  await expect(
    page.locator('[data-inspection-tooltip="true"] [data-slot="tree-status"]')
  ).toHaveText("Allocated")
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await expect(background).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem("exile.tree.ascendancy"))
  ).toBe("Oracle")
})

for (const width of [390, 1440])
  test(`sidebar keystone opens a focused tree callout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(process.env.BUILD_TEST_URL || "/build-bin")
    await page.getByLabel("PoB export or pobb.in link").fill(code)
    const card = page
      .locator('[data-slot="tree-keystone-card"]')
      .filter({ hasText: "Blood Magic" })
    const open = card.getByRole("button", {
      name: "Show Blood Magic in passive tree",
    })
    await card.scrollIntoViewIfNeeded()
    await expect(
      card.getByRole("heading", { name: "Blood Magic" })
    ).toBeVisible()
    await expect(card.locator('[data-slot="tree-status"]')).toHaveText(
      "Allocated"
    )
    await expect(card.locator("img")).toBeVisible()
    const bounds = (await card.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    const dialog = page.getByRole("dialog", {
      name: "Passive tree",
      exact: true,
    })
    for (const keyboard of [true, false]) {
      if (keyboard) {
        await open.focus()
        await open.press("Enter")
      } else await open.click()
      await expect(dialog).toBeVisible()
      const callout = page.locator(
        '[data-inspection-tooltip="true"][data-search-callout="true"]'
      )
      await expect(callout).toBeVisible()
      await expect(
        callout.getByRole("heading", { name: "Blood Magic", exact: true })
      ).toBeVisible()
      await expect(callout).toHaveAttribute("data-attention", "true")
      await expect(callout.locator('[data-slot="tree-status"]')).toHaveText(
        "Allocated"
      )
      const node = dialog.locator('circle[data-node="51749"]')
      await expect(node).toBeInViewport()
      await expect(dialog.locator("[data-search-match-count]")).toHaveAttribute(
        "data-search-match-count",
        "1"
      )
      await dialog.getByRole("button", { name: "Close", exact: true }).click()
      await expect(dialog).toBeHidden()
      await expect(open).toBeFocused()
    }
    await page.getByRole("button", { name: "Open tree", exact: true }).click()
    await expect(dialog).toBeVisible()
    await expect(page.locator('[data-search-callout="true"]')).toHaveCount(0)
  })
