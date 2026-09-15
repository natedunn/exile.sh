import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { readFileSync } from "node:fs"
const code = readFileSync(
  new URL("../shared/fixtures/pob/2k0EPn6QOhTx.txt", import.meta.url),
  "utf8"
)
async function selectResult(page: Page, query: string) {
  await expect(page.locator(".tree-search").last()).toBeVisible()
  const open = page.getByRole("button", { name: "Search tree", exact: true })
  if (await open.isVisible()) await open.click()
  await page.getByRole("textbox", { name: "Search nodes" }).fill(query)
  await expect(
    page.getByRole("status").filter({ hasText: /matching node/ })
  ).toBeVisible()
  await page.locator('[data-result-index="0"]').last().click()
  const popup = page.locator('[data-search-callout="true"]')
  await expect(popup).toBeVisible()
  return popup
}
test("search callout glows briefly, stays open, and dismisses on the next interaction", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "heavy ammunition")
  await expect(popup).toHaveAttribute("data-attention", "true")
  await expect(popup.locator("h2")).toHaveText("Heavy Ammunition")
  await expect(page.locator('[data-tooltip-pinned="true"]')).toHaveCount(0)
  await expect(popup).not.toHaveAttribute("data-attention", "true", {
    timeout: 5000,
  })
  await expect(popup).toBeVisible()
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  await expect(popup).toHaveCount(0)
  await selectResult(page, "heavy ammunition")
  await page.keyboard.press("ArrowDown")
  await expect(popup).toHaveCount(0)
})
test("Alt offers Pin instead of Close; explicit pins follow their node without drag controls", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  await selectResult(page, "heavy ammunition")
  await page.getByRole("button", { name: "Zoom in", exact: true }).click()
  const node = page
    .locator(".tree-viewport [data-node]")
    .filter({ visible: true })
  const id = await node.evaluateAll((elements) =>
    elements
      .find((element) => {
        const box = element.getBoundingClientRect()
        return box.x > 350 && box.x < 800 && box.y > 300 && box.y < 650
      })
      ?.getAttribute("data-node")
  )
  expect(id).toBeTruthy()
  await page.locator(`[data-node="${id}"]`).hover()
  await expect(page.locator(".tree-inspection")).toBeVisible()
  await page.keyboard.down("Alt")
  await expect(
    page.locator(".tree-inspection .tooltip-pin-control")
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Close node details" })
  ).toHaveCount(0)
  await page.locator(".tree-inspection .tooltip-pin-control").click()
  await page.keyboard.up("Alt")
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  const before = (await pin.boundingBox())!
  await page.getByRole("button", { name: "Zoom out", exact: true }).click()
  await expect(pin).toBeVisible()
  const after = (await pin.boundingBox())!
  expect(
    Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
  ).toBeGreaterThan(1)
  await expect(pin.getByRole("button", { name: /^Move pinned/ })).toHaveCount(0)
  await pin.getByRole("button", { name: /^Close pinned/ }).click()
  await expect(pin).toHaveCount(0)
})
for (const width of [1440, 390]) {
  test(`tree pin limits and view cleanup at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/trees/passive")
    for (const [index, query] of [
      "heavy ammunition",
      "versatile arms",
      "brutal",
      "relentless",
      "life",
      "mana",
    ].entries()) {
      const popup = await selectResult(page, query)
      await popup.locator(".tooltip-pin-control").click()
      await expect(page.locator('[data-tooltip-pinned="true"]')).toHaveCount(
        Math.min(index + 1, width < 768 ? 1 : 5)
      )
    }
    await page.getByRole("link", { name: "Atlas Trees", exact: true }).click()
    await expect(page.locator('[data-tooltip-pinned="true"]')).toHaveCount(0)
  })
}
test("Build Bin pins one item or gem and keeps it fixed while scrolling", async ({
  page,
}) => {
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  const item = page.getByRole("button", {
    name: "Main hand: Beast Cry. Show item details",
  })
  await item.scrollIntoViewIfNeeded()
  await item.hover({ position: { x: 4, y: 4 } })
  await page.keyboard.down("Alt")
  await page.locator(".equipment-card .tooltip-pin-control").click()
  await page.keyboard.up("Alt")
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toHaveCount(1)
  const before = (await pin.boundingBox())!
  await page.mouse.move(10, 10)
  await page.mouse.wheel(0, 250)
  await expect
    .poll(async () => (await pin.boundingBox())!.y)
    .toBeCloseTo(before.y, 0)
  const gem = page.locator(".skill-gem-row").first()
  await gem.scrollIntoViewIfNeeded()
  await gem.hover()
  await page.keyboard.down("Alt")
  await page.locator(".skill-gem-tooltip .tooltip-pin-control").click()
  await page.keyboard.up("Alt")
  await expect(pin).toHaveCount(1)
  await expect(pin).toHaveClass(/skill-gem-tooltip/)
})
test("a fullscreen tree pin is interactive and closes with its view", async ({
  page,
}) => {
  await page.goto("/build-bin")
  await page.getByLabel("PoB export or pobb.in link").fill(code)
  await page.getByRole("button", { name: "Open tree", exact: true }).click()
  const popup = await selectResult(page, "heavy ammunition")
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  await pin.getByRole("button", { name: /^Close pinned/ }).click()
  await expect(pin).toHaveCount(0)
  const second = await selectResult(page, "heavy ammunition")
  await second.locator(".tooltip-pin-control").click()
  await page.locator('.tree-fullscreen [data-slot="dialog-close"]').click()
  await expect(pin).toHaveCount(0)
})

test("pinned tooltip grows for wrapped content and stays inside a shorter viewport", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "at your command")
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  await expect
    .poll(() =>
      pin.evaluate((element) => element.scrollHeight - element.clientHeight)
    )
    .toBeLessThanOrEqual(1)
  await page
    .getByRole("button", { name: "Close tree search", exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 300 })
  await expect
    .poll(async () => {
      const box = (await pin.boundingBox())!
      return box.y + box.height
    })
    .toBeLessThanOrEqual(289)
  await expect(pin).toHaveCSS("overflow-y", "auto")
})

for (const width of [1440, 390]) {
  test(`pinned list reuses search rows and navigates at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/trees/passive")
    const popup = await selectResult(page, "heavy ammunition")
    await popup.locator(".tooltip-pin-control").click()
    const count = page.getByRole("button", {
      name: "1 pinned node",
      exact: true,
    })
    await expect(count).toBeVisible()
    await count.click()
    await expect(page.locator(".tree-search")).toHaveAttribute(
      "data-open",
      "false"
    )
    const panel = page.locator(".tree-pins-panel")
    await expect(panel).toBeVisible()
    await expect(panel.locator(".tree-search-art img")).toBeVisible()
    const row = panel.getByRole("button", { name: /Heavy Ammunition/ })
    await row.click()
    await expect(panel).toHaveCount(0)
    await expect(page.locator('[data-tooltip-pinned="true"]')).toBeVisible()
    await expect(page.locator('[data-search-callout="true"]')).toHaveCount(0)
    await count.click()
    await page.keyboard.press("ArrowDown")
    await expect(row).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(panel).toHaveCount(0)
    await page.getByRole("button", { name: /^Close pinned/ }).click()
    await expect(count).toHaveCount(0)
  })
}

test("pinned tooltip tracks every pan frame and hides without jumping offscreen", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "heavy ammunition")
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  const report = await pin.evaluate(async (element) => {
    const svg = document.querySelector<SVGSVGElement>(".tree-viewport svg")!
    const positioner = element.closest<HTMLElement>(".tree-pinned-positioner")!
    const initial = svg.getAttribute("viewBox")!
    const values = initial.split(/\s+/).map(Number)
    const box = element.getBoundingClientRect()
    const node = new DOMPoint(
      box.x + box.width / 2,
      box.bottom + 28
    ).matrixTransform(svg.getScreenCTM()!.inverse())
    const errors: number[] = []
    let hiddenFrames = 0
    let hiddenJumps = 0
    let lastTransform = getComputedStyle(positioner).transform
    try {
      for (const step of [
        ...Array.from({ length: 18 }, (_, i) => i),
        ...Array.from({ length: 18 }, (_, i) => 17 - i),
      ]) {
        svg.setAttribute(
          "viewBox",
          [values[0] + (values[2] * step) / 12, ...values.slice(1)].join(" ")
        )
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        )
        const anchor = node.matrixTransform(svg.getScreenCTM()!)
        const transform = getComputedStyle(positioner).transform
        if (positioner.dataset.treePinVisible !== "true") {
          hiddenFrames++
          if (transform !== lastTransform) hiddenJumps++
        } else {
          const actual = element.getBoundingClientRect()
          const x = Math.max(
            12,
            Math.min(
              anchor.x - actual.width / 2,
              innerWidth - actual.width - 12
            )
          )
          const y = Math.max(
            12,
            Math.min(
              anchor.y - actual.height - 28,
              innerHeight - actual.height - 12
            )
          )
          errors.push(Math.abs(actual.x - x) + Math.abs(actual.y - y))
        }
        lastTransform = transform
      }
    } finally {
      svg.setAttribute("viewBox", initial)
    }
    return { maxError: Math.max(...errors), hiddenFrames, hiddenJumps }
  })
  expect(report.maxError).toBeLessThan(2)
  expect(report.hiddenFrames).toBeGreaterThan(0)
  expect(report.hiddenJumps).toBe(0)
  await expect(pin).toBeVisible()
})

test("pinned nodes suppress hover and Clear all pins restores it", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "heavy ammunition")
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  const box = (await pin.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 28)
  await expect(
    page.locator('.tree-inspection:not([data-tooltip-pinned="true"])')
  ).toHaveCount(0)
  const count = page.getByRole("button", { name: "1 pinned node", exact: true })
  const control = (await count.boundingBox())!
  const zoom = (await page
    .getByRole("button", { name: "Zoom in", exact: true })
    .boundingBox())!
  expect(control.y).toBeCloseTo(zoom.y, 0)
  await count.click()
  await expect(
    page.locator('.tree-pins-heading [data-slot="popover-title"] svg')
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Clear all pins", exact: true })
    .click()
  await expect(pin).toHaveCount(0)
  await expect(count).toHaveCount(0)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 28)
  await expect(
    page.locator('.tree-inspection:not([data-tooltip-pinned="true"])')
  ).toBeVisible()
})

test("pinned pointer matches the border and stays aimed at its node", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "heavy ammunition")
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  const arrow = page.locator(".tree-pin-pointer polygon")
  await expect(arrow).toHaveAttribute("points", /\S+/)
  await expect(
    page.locator(".tree-pinned-positioner .tree-pointer-base")
  ).toHaveCSS("stop-color", "rgb(58, 52, 44)")
  await expect(pin).toHaveCSS("border-top-color", "rgb(58, 52, 44)")
  const before = await arrow.getAttribute("points")
  const svg = page.locator(".tree-viewport svg")
  await svg.evaluate((element) => {
    const box = element.viewBox.baseVal
    element.setAttribute(
      "viewBox",
      `${box.x + box.width * 0.49} ${box.y} ${box.width} ${box.height}`
    )
  })
  await expect(arrow).not.toHaveAttribute("points", before!)
  await expect(pin).toBeVisible()
  const error = await arrow.evaluate((polygon) => {
    const points = (polygon as SVGPolygonElement).points
    const baseX = (points.getItem(0).x + points.getItem(2).x) / 2
    const tip = points.getItem(1)
    // Near the left edge the tip leans left toward the node instead of staying centered.
    return tip.x - baseX
  })
  expect(error).toBeLessThan(0)
})

test("hover and pinned pointers are visible above the shadow without a pinning jump", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const popup = await selectResult(page, "scarred faith")
  const positioner = page.locator(".tree-node-positioner")
  const arrow = positioner.locator(".tree-pin-pointer")
  await expect(arrow.locator("polygon")).toHaveAttribute("points", /\S+/)
  await expect(arrow).toHaveCSS("z-index", "51")
  await expect(popup).not.toHaveAttribute("data-attention", "true", {
    timeout: 5000,
  })
  const before = (await popup.boundingBox())!
  await popup.locator(".tooltip-pin-control").click()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  await expect
    .poll(async () => {
      const after = (await pin.boundingBox())!
      return Math.abs(after.x - before.x) + Math.abs(after.y - before.y)
    })
    .toBeLessThan(2)
  await expect(
    page.locator(".tree-pinned-positioner .tree-pin-pointer")
  ).toHaveCSS("z-index", "51")
  await page.screenshot({ path: "/tmp/exile-pointer-corrected.png" })
})

test("pointer is shorter, gradients toward its tip and shares the search glow", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  await selectResult(page, "heavy ammunition")
  const pointer = page.locator(".tree-node-positioner .tree-pin-pointer")
  await expect(pointer.locator("polygon")).toHaveCSS(
    "animation-name",
    "tree-pointer-attention"
  )
  await expect(pointer.locator(".tree-pointer-base")).toHaveCSS(
    "animation-name",
    "tree-pointer-border-attention"
  )
  const length = await pointer.locator("polygon").evaluate((element) => {
    const points = (element as SVGPolygonElement).points
    return Math.hypot(
      points.getItem(1).x - (points.getItem(0).x + points.getItem(2).x) / 2,
      points.getItem(1).y - points.getItem(0).y
    )
  })
  expect(length).toBeCloseTo(12, 1)
  await expect(pointer.locator(".tree-pointer-tip")).toHaveCSS(
    "stop-color",
    "rgb(184, 164, 139)"
  )
  await expect(pointer.locator("polygon")).toHaveCSS("animation-name", "none", {
    timeout: 5000,
  })
  await expect(pointer.locator(".tree-pointer-base")).toHaveCSS(
    "stop-color",
    "rgb(58, 52, 44)"
  )
  await page.screenshot({ path: "/tmp/exile-pointer-gradient.png" })
})

for (const width of [1440, 390]) {
  test(`close button hides with its pinned tooltip on the first frame at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/trees/passive")
    const popup = await selectResult(page, "heavy ammunition")
    await popup.locator(".tooltip-pin-control").click()
    const pin = page.locator('[data-tooltip-pinned="true"]')
    await expect(pin).toBeVisible()
    const states = await pin.evaluate(async (element) => {
      const svg = document.querySelector<SVGSVGElement>(".tree-viewport svg")!
      const initial = svg.getAttribute("viewBox")!
      const positioner = element.closest<HTMLElement>(
        ".tree-pinned-positioner"
      )!
      const button = element.querySelector("button")!
      const box = svg.viewBox.baseVal
      svg.setAttribute(
        "viewBox",
        `${box.x + box.width * 2} ${box.y} ${box.width} ${box.height}`
      )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
      const hidden = {
        pin: positioner.dataset.treePinVisible,
        button: getComputedStyle(button).visibility,
        pointer: getComputedStyle(
          positioner.querySelector(".tree-pin-pointer")!
        ).visibility,
      }
      svg.setAttribute("viewBox", initial)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      )
      return { hidden, restored: getComputedStyle(button).visibility }
    })
    expect(states.hidden).toEqual({
      pin: "false",
      button: "hidden",
      pointer: "hidden",
    })
    expect(states.restored).toBe("visible")
  })
}

test("changing Paths Not Taken clears pins from the previous tree data", async ({
  page,
}) => {
  await page.goto("/trees/passive?section=Oracle")
  const popup = await selectResult(page, "heavy ammunition")
  await popup.locator(".tooltip-pin-control").click()
  await expect(page.locator('[data-tooltip-pinned="true"]')).toHaveCount(1)
  await page.getByRole("checkbox", { name: "Paths Not Taken" }).check()
  await expect(page.locator('[data-tooltip-pinned="true"]')).toHaveCount(0)
  await expect(page.locator(".tree-pins > button")).toHaveCount(0)
})

test("hovering a different node replaces a search callout", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  await selectResult(page, "heavy ammunition")
  const target = await page
    .locator(".tree-viewport [data-node]")
    .evaluateAll((elements) => {
      const popup = document
        .querySelector('[data-search-callout="true"]')!
        .getBoundingClientRect()
      for (const element of elements) {
        const box = element.getBoundingClientRect()
        const x = box.x + box.width / 2,
          y = box.y + box.height / 2
        if (
          x > 300 &&
          x < 800 &&
          y > 300 &&
          y < 650 &&
          (x < popup.left ||
            x > popup.right ||
            y < popup.top ||
            y > popup.bottom)
        )
          return { x, y }
      }
      return null
    })
  expect(target).toBeTruthy()
  await page.mouse.move(target!.x, target!.y)
  await expect(page.locator('[data-search-callout="true"]')).toHaveCount(0)
  await expect(
    page.locator('.tree-inspection:not([data-tooltip-pinned="true"])')
  ).toBeVisible()
  await expect(page.locator(".tree-inspection h2")).not.toHaveText(
    "Heavy Ammunition"
  )
})

test("an empty touch does not leave desktop hover in touch-inspection mode", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  await page.goto("/trees/passive")
  await selectResult(page, "heavy ammunition")
  const positions = await page.locator(".tree-viewport svg").evaluate((svg) => {
    const nodes = [...svg.querySelectorAll("[data-node]")]
    const target = nodes
      .map((node) => node.getBoundingClientRect())
      .find((box) => box.x > 300 && box.x < 800 && box.y > 550 && box.y < 750)!
    for (let y = 650; y < 780; y += 15) {
      for (let x = 350; x < 800; x += 15) {
        const element = document.elementFromPoint(x, y)
        if (element && svg.contains(element) && !element.closest("[data-node]"))
          return {
            empty: { x, y },
            target: {
              x: target.x + target.width / 2,
              y: target.y + target.height / 2,
            },
          }
      }
    }
    return null
  })
  expect(positions).toBeTruthy()
  await page.touchscreen.tap(positions!.empty.x, positions!.empty.y)
  await page.mouse.move(positions!.target.x, positions!.target.y)
  const popup = page.locator(
    '.tree-inspection:not([data-tooltip-pinned="true"])'
  )
  await expect(popup).toBeVisible()
  await expect(popup.locator(".tooltip-pin-control")).toHaveCount(0)
  await context.close()
})
