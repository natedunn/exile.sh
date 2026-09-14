import { expect, test } from "@playwright/test"

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
]) {
  test(`standalone tree fits ${viewport.width}×${viewport.height} and supports versioned exploration`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto("/trees")
    const map = page.locator(".standalone-tree .tree-viewport svg")
    await expect(map).toBeVisible()
    // Upstream image-only decorations must not become interactive passives.
    await expect(map.locator('[data-node="857"]')).toHaveCount(0)
    // Missing artwork alone must not remove the real Sinister Jewel Socket.
    await expect(map.locator('[data-node="11184"]')).toHaveCount(1)
    const noOverflow = async () => {
      expect(
        await page.evaluate(() => ({
          vertical: document.documentElement.scrollHeight > innerHeight,
          horizontal: document.documentElement.scrollWidth > innerWidth,
          scrollY,
        }))
      ).toEqual({ vertical: false, horizontal: false, scrollY: 0 })
    }
    await noOverflow()
    const canvas = (await page
      .locator(".standalone-tree .tree-viewport")
      .boundingBox())!
    expect(canvas.x).toBe(0)
    expect(canvas.width).toBe(viewport.width)
    for (const selector of [".viewer-header", ".viewer-footer"]) {
      const bounds = (await page.locator(selector).boundingBox())!
      expect(bounds.x).toBe(0)
      expect(bounds.width).toBe(viewport.width)
    }
    await expect(page.locator(".viewer-shell .topbar")).toHaveCount(0)
    const original = await map.getAttribute("viewBox")
    await map.focus()
    await page.keyboard.press("+")
    await expect(map).not.toHaveAttribute("viewBox", original!)
    const box = (await map.boundingBox())!
    expect(box.height).toBeGreaterThan(100)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const zoomed = await map.getAttribute("viewBox")
    await page.mouse.wheel(0, -200)
    await expect(map).not.toHaveAttribute("viewBox", zoomed!)
    await noOverflow()
    await page.getByRole("combobox", { name: "Tree version" }).click()
    await page.getByRole("option", { name: "0.1", exact: true }).click()
    await expect(page).toHaveURL(/version=0_1/)
    await expect(map).toBeVisible()
    await page
      .getByRole("navigation", { name: "Tree types" })
      .getByRole("link", { name: "Ascendancy Trees", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Ascendancy", exact: true })
      .click()
    await page.getByRole("option").first().click()
    await expect(map).toBeVisible()
    await noOverflow()
    await expect(page.getByRole("button", { name: "Fullscreen" })).toHaveCount(
      0
    )
    await noOverflow()
    // Native keyboard selection and history both retain a valid snapshot.
    await expect(page.getByRole("listbox")).toHaveCount(0)
    await page
      .getByRole("combobox", { name: "Tree version" })
      .press("ArrowDown")
    await expect(
      page.getByRole("option", { name: "0.5", exact: true })
    ).toBeVisible()
    await page.keyboard.press("Home")
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/version=0_5/)
    await page.goBack()
    await expect(page).toHaveURL(/version=0_1/)
    await expect(map).toBeVisible()
    await page.goto("/build-bin")
    await expect(page.locator(".viewer-shell")).toHaveCount(0)
    expect(
      await page
        .locator("body")
        .evaluate((body) => getComputedStyle(body).overflowY)
    ).not.toBe("hidden")
  })
}

test("tree load failures can be retried and invalid versions fall back", async ({
  page,
}) => {
  await page.route("**/pob-trees/passives-v1/0_5.json", (route) =>
    route.fulfill({ status: 503 })
  )
  await page.goto("/trees?version=invalid")
  await expect(
    page.getByRole("button", { name: "Retry", exact: true })
  ).toBeVisible({ timeout: 20000 })
  await page.unroute("**/pob-trees/passives-v1/0_5.json")
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.locator(".tree-viewport svg")).toBeVisible()
})

test("Paths Not Taken toggle supports keyboard and historical versions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/trees/passive?section=Oracle")
  const toggle = page.getByRole("checkbox", { name: "Paths Not Taken" })
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.locator('[data-node="479"]')).toHaveCount(0)
  await toggle.focus()
  await page.keyboard.press("Space")
  await expect(toggle).toBeChecked()
  await expect(page).toHaveURL(/unseen=true/)
  await expect(page.locator("[data-node][data-unseen-path]")).toHaveCount(176)
  await expect(page.locator("path[data-unseen-path]").first()).toBeAttached()
  await toggle.uncheck()
  await expect(page.locator("[data-unseen-path]")).toHaveCount(0)
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await page.reload()
  await expect(toggle).toBeChecked()
  await expect(page.locator("[data-node][data-unseen-path]")).toHaveCount(176)
  await page.getByRole("combobox", { name: "Tree version" }).click()
  await page.getByRole("option", { name: "0.4", exact: true }).click()
  await expect(page.locator("[data-node][data-unseen-path]")).toHaveCount(176)
  await page.getByRole("combobox", { name: "Tree version" }).click()
  await page.getByRole("option", { name: "0.1", exact: true }).click()
  await expect(toggle).toHaveCount(0)
  await expect(page.locator("[data-unseen-path]")).toHaveCount(0)
})

test("toggling Oracle paths preserves framing, zoom and pan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/trees/passive?section=Oracle")
  const map = page.locator(".standalone-tree .tree-viewport svg")
  const toggle = page.getByRole("checkbox", { name: "Paths Not Taken" })
  await expect(map).toBeVisible()
  const checkToggle = async () => {
    const view = await map.getAttribute("viewBox")
    const nodeId = await map
      .locator("[data-node]:not([data-unseen-path])")
      .first()
      .getAttribute("data-node")
    const node = map.locator(`[data-node="${nodeId}"]`)
    const position = await node.boundingBox()
    for (const checked of [true, false, true, false]) {
      await toggle.setChecked(checked)
      if (!checked)
        await expect(map.locator("[data-node][data-unseen-path]")).toHaveCount(
          0
        )
      else if ((await page.locator(".tree-zoom").textContent()) === "1.0×")
        await expect(map.locator("[data-node][data-unseen-path]")).toHaveCount(
          176
        )
      // Let React's post-render camera constraints run before comparing.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      expect(await map.getAttribute("viewBox")).toBe(view)
      expect(await node.boundingBox()).toEqual(position)
    }
  }
  await checkToggle()
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await map.focus()
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft")
  await checkToggle()
  await page.getByRole("button", { name: "Reset", exact: true }).click()
  await checkToggle()
})

test("tree pages offer contextual controls and keep zoom inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/trees")
  await expect(page.locator(".tree-viewport svg")).toBeVisible()
  const nav = page.getByRole("navigation", { name: "Tree types" })
  await expect(
    page.getByRole("combobox", { name: "Ascendancy", exact: true })
  ).toHaveCount(0)
  await nav.getByRole("link", { name: "Atlas Trees", exact: true }).click()
  await expect(page).toHaveURL(/\/trees\/atlas/)
  await expect(
    page.getByRole("combobox", { name: "Tree version" })
  ).toHaveCount(0)
  await expect(page.locator("[data-node]")).toHaveCount(537)
  await expect(page.locator(".tree-explorer-options")).toHaveCount(0)
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  const canvas = (await page.locator(".tree-viewport").boundingBox())!
  const controls = (await page.locator(".tree-controls").boundingBox())!
  expect(controls.x).toBeGreaterThan(canvas.x)
  expect(controls.y).toBeGreaterThan(canvas.y)
  expect(canvas.y + canvas.height - controls.y - controls.height).toBeCloseTo(
    14,
    0
  )
  expect(canvas.x + canvas.width - controls.x - controls.width).toBeCloseTo(
    14,
    0
  )
  const map = page.locator(".tree-viewport svg")
  const view = await map.getAttribute("viewBox")
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(map).not.toHaveAttribute("viewBox", view!)
  await expect(page.getByRole("button", { name: "Fullscreen" })).toHaveCount(0)
  await page.reload()
  await expect(page.locator("[data-node]")).toHaveCount(537)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight
    )
  ).toBe(false)
  await nav.getByRole("link", { name: "Passive Tree", exact: true }).click()
  await expect(
    page.getByRole("combobox", { name: "Show ascendancy" })
  ).toBeVisible()
})

test("ascendancy links survive reload, version changes and history", async ({
  page,
}) => {
  await page.goto("/trees/ascendancies?section=Oracle&version=0_5")
  const choice = page.getByRole("combobox", { name: "Ascendancy", exact: true })
  await expect(choice).toContainText("Oracle")
  await expect(
    page.locator('[data-ascendancy-background="Oracle"]')
  ).toBeVisible()
  await expect(page.locator(".tree-passive-art").first()).toBeAttached()
  await expect(page.locator(".tree-controls")).toHaveCount(0)
  const map = page.locator(".tree-viewport svg")
  const view = await map.getAttribute("viewBox")
  await map.focus()
  await page.keyboard.press("+")
  await page.keyboard.press("-")
  await page.keyboard.press("ArrowRight")
  const box = (await map.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(100)
  await expect(map).toHaveAttribute("viewBox", view!)
  await map.focus()
  await page.keyboard.press("Enter")
  await expect(page.locator(".tree-inspection")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(".tree-viewport svg")).toBeVisible()
  await expect(page.getByRole("checkbox")).toHaveCount(0)
  await choice.click()
  await page.getByRole("option", { name: "Amazon", exact: true }).click()
  await expect(page).toHaveURL(/section=Amazon/)
  await expect(
    page.locator('[data-ascendancy-background="Amazon"]')
  ).toBeVisible()
  await page.reload()
  await expect(choice).toContainText("Amazon")
  await page
    .getByRole("navigation", { name: "Tree types" })
    .getByRole("link", { name: "Passive Tree", exact: true })
    .click()
  await expect(
    page.getByRole("combobox", { name: "Show ascendancy" })
  ).toBeVisible()
  await page.goBack()
  await expect(choice).toContainText("Amazon")
  await page.getByRole("combobox", { name: "Tree version" }).click()
  await page.getByRole("option", { name: "0.1", exact: true }).click()
  await expect(choice).not.toContainText("Amazon")
  await expect(page.locator(".tree-viewport svg")).toBeVisible()
})

for (const [legacy, target] of [
  ["/trees?section=atlas", "/trees/atlas"],
  ["/trees?section=Oracle", "/trees/ascendancies"],
  ["/passive-tree?version=0_4&unseen=true", "/trees/passive"],
]) {
  test(`legacy tree link ${legacy} redirects`, async ({ page }) => {
    await page.goto(legacy)
    await expect(page).toHaveURL(new RegExp(target))
    await expect(page.locator(".tree-viewport svg")).toBeVisible()
  })
}

test("ascendancies load independently and keep the selector inside the viewer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests: string[] = []
  page.on("request", (request) => requests.push(request.url()))
  await page.goto("/trees/ascendancies?section=Oracle")
  await expect(
    page.locator('[data-ascendancy-background="Oracle"]')
  ).toBeVisible()
  const canvas = (await page.locator(".tree-viewport").boundingBox())!
  const panel = page.locator(".tree-settings-panel")
  const selector = (await panel.boundingBox())!
  await expect(
    panel.getByRole("combobox", { name: "Ascendancy", exact: true })
  ).toBeVisible()
  await expect(
    panel.getByRole("combobox", { name: "Tree version" })
  ).toBeVisible()
  await expect(page.locator(".tree-explorer-options")).toHaveCount(0)
  expect(selector.x - canvas.x).toBeCloseTo(14, 0)
  expect(selector.y - canvas.y).toBeCloseTo(14, 0)
  expect(requests.some((url) => /\/pob-trees\/v4\//.test(url))).toBe(false)
  expect(
    requests.some((url) => /\/pob-trees\/art-v2\/0_5.json/.test(url))
  ).toBe(false)
  expect(
    requests
      .filter((url) => /ascendancies-v1.*\.json/.test(url))
      .map((url) => new URL(url).pathname)
      .sort()
  ).toEqual([
    "/pob-trees/ascendancies-v1/0_5/oracle-art.json",
    "/pob-trees/ascendancies-v1/0_5/oracle.json",
  ])
  await page.getByRole("combobox", { name: "Ascendancy", exact: true }).click()
  await page.getByRole("option", { name: "Amazon", exact: true }).click()
  await expect(
    page.locator('[data-ascendancy-background="Amazon"]')
  ).toBeVisible()
  expect(requests.some((url) => url.endsWith("/amazon.json"))).toBe(true)
})

test("ascendancy selector stays usable while a tree is unavailable", async ({
  page,
}) => {
  await page.route("**/ascendancies-v1/0_5/oracle.json", (route) =>
    route.fulfill({ status: 503 })
  )
  await page.goto("/trees/ascendancies?section=Oracle")
  await expect(
    page.getByRole("button", { name: "Retry", exact: true })
  ).toBeVisible({ timeout: 20000 })
  await page.getByRole("combobox", { name: "Ascendancy", exact: true }).click()
  await page.getByRole("option", { name: "Amazon", exact: true }).click()
  await expect(
    page.locator('[data-ascendancy-background="Amazon"]')
  ).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("Abyssal Lich shows alternate passives and its own artwork", async ({
  page,
}) => {
  await page.goto("/trees/ascendancies?section=Abyssal%20Lich&version=0_5")
  await expect(
    page.getByRole("combobox", { name: "Ascendancy", exact: true })
  ).toContainText("Abyssal Lich")
  await expect(
    page.locator('[data-ascendancy-background="Abyssal Lich"]')
  ).toBeVisible()
  await expect(page.locator("[data-node]")).toHaveCount(19)
  await page.locator('[data-node="41162"]').hover()
  await expect(page.locator(".tree-inspection")).toContainText("Umbral Well")
  await page.getByRole("combobox", { name: "Tree version" }).click()
  await page.getByRole("option", { name: "0.2", exact: true }).click()
  await page.getByRole("combobox", { name: "Ascendancy", exact: true }).click()
  await expect(
    page.getByRole("option", { name: "Abyssal Lich", exact: true })
  ).toHaveCount(0)
})

test("buffered panning retains visible nodes and commits the final camera", async ({
  page,
}) => {
  await page.goto("/trees/passive?section=Oracle")
  const map = page.locator(".tree-viewport svg")
  await expect(map).toBeVisible()
  const total = await map.locator("[data-node]").count()
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect
    .poll(() => map.locator("[data-node]").count())
    .toBeLessThan(total / 2)
  const box = (await map.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.7, {
    steps: 30,
  })
  await page.mouse.up()
  const final = await map.getAttribute("viewBox")
  const response = await page.request.get("/pob-trees/passives-v1/0_5.json")
  const data = await response.json()
  const [x, y, width, height] = final!.split(" ").map(Number)
  await page.getByRole("checkbox", { name: "Paths Not Taken" }).check()
  await expect(map).toHaveAttribute("viewBox", final!)
  const enabledIds = await map
    .locator("[data-node]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node")))
  expect(new Set(enabledIds).size).toBe(enabledIds.length)
  for (const node of data.nodes)
    if (
      !node.start &&
      !node.ascendancy &&
      node.x > x + 150 &&
      node.x < x + width - 150 &&
      node.y > y + 150 &&
      node.y < y + height - 150
    )
      expect(enabledIds).toContain(node.id)
})

test("held inspection survives its node leaving the rendering buffer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/trees/passive")
  const map = page.locator(".tree-viewport svg")
  await expect(map).toBeVisible()
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(map.locator(".tree-passive-art").first()).toBeAttached()
  const id = await map.locator("[data-node]").evaluateAll((nodes) =>
    nodes
      .find((node) => {
        const box = node.getBoundingClientRect()
        return box.x > 300 && box.x < 1100 && box.y > 300 && box.y < 700
      })
      ?.getAttribute("data-node")
  )
  expect(id).toBeTruthy()
  const target = map.locator(`[data-node="${id}"]`)
  await target.hover()
  const tooltip = page.locator(".tree-inspection")
  await expect(tooltip).toBeVisible()
  const title = await tooltip.locator("h2").textContent()
  await page.keyboard.down("Alt")
  await map.focus()
  for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowRight")
  await expect(target).toHaveCount(0)
  await expect(tooltip).toBeVisible()
  await expect(tooltip.locator("h2")).toHaveText(title!)
  await expect(map.locator(".tree-inspect-ring")).toHaveCount(1)
  await page.keyboard.up("Alt")
  await expect(tooltip).toHaveCount(0)
})

test("batched node paint covers every target and artwork image once", async ({
  page,
}) => {
  await page.goto("/trees/passive?section=Oracle")
  const map = page.locator(".tree-viewport svg")
  await expect(map).toBeVisible()
  await page.getByRole("checkbox", { name: "Paths Not Taken" }).check()
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(map.locator(".tree-passive-art").first()).toBeAttached()
  const counts = await map.evaluate((svg) => {
    const sum = (selector: string) =>
      [...svg.querySelectorAll(selector)].reduce(
        (n, element) => n + Number(element.getAttribute("data-disc-count")),
        0
      )
    return {
      targets: svg.querySelectorAll("[data-node]").length,
      fills: sum("[data-node-fill]"),
      unseen: svg.querySelectorAll("[data-node][data-unseen-path]").length,
      unseenFills: sum('[data-node-fill="unseen"]'),
      images: svg.querySelectorAll(".tree-passive-art").length,
      backgrounds: sum("[data-art-background]"),
      borders: sum("[data-art-border]"),
      fillPaths: svg.querySelectorAll("[data-node-fill]").length,
    }
  })
  expect(counts.fills).toBe(counts.targets)
  expect(counts.unseenFills).toBe(counts.unseen)
  expect(counts.unseen).toBeGreaterThan(0)
  expect(counts.backgrounds).toBe(counts.images)
  expect(counts.borders).toBe(counts.images)
  expect(counts.fillPaths).toBeLessThan(counts.targets / 2)
})
