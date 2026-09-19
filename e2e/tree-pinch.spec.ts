import { expect, test } from "@playwright/test"

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
})

for (const route of ["passive", "atlas"]) {
  test(`${route}: pinch zooms the tree without zooming the page`, async ({
    page,
  }) => {
    await page.goto(`/trees/${route}`)
    const svg = page.locator("[data-slot=tree-viewport] svg")
    await expect(svg).toBeVisible()
    const box = (await svg.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height * 0.6
    const cdp = await page.context().newCDPSession(page)
    const points = (gap: number) => [
      { id: 1, x: x - gap, y },
      { id: 2, x: x + gap, y },
    ]
    const width = async () =>
      Number((await svg.getAttribute("viewBox"))!.split(" ")[2])
    const initialWidth = await width()
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(20),
    })
    for (let gap = 25; gap <= 100; gap += 5)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(gap),
      })
    await expect.poll(width).toBeLessThan(initialWidth * 0.6)
    const expandedWidth = await width()
    for (let gap = 95; gap >= 65; gap -= 5)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(gap),
      })
    await expect.poll(width).toBeGreaterThan(expandedWidth * 1.4)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [points(65)[1]],
    })
    const beforePan = await svg.getAttribute("viewBox")
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x: x - 25, y: y + 20 }],
    })
    await expect(svg).not.toHaveAttribute("viewBox", beforePan!)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)
    await cdp.detach()
  })
}

test("a drifting touch opens a tooltip and quick taps pin and close it", async ({
  page,
}) => {
  await page.goto("/trees/passive")
  const svg = page.locator("[data-slot=tree-viewport] svg")
  await expect(svg.locator("[data-node]").first()).toBeAttached()
  await svg.scrollIntoViewIfNeeded()
  const target = await svg.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    for (const node of element.querySelectorAll("[data-node]")) {
      const box = node.getBoundingClientRect()
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      if (
        x > bounds.left + 40 &&
        x < bounds.right - 40 &&
        y > Math.max(bounds.top + 40, 100) &&
        y < Math.min(bounds.bottom - 40, innerHeight - 100) &&
        document.elementFromPoint(x, y)?.closest("[data-node]") === node
      )
        return { x, y }
    }
    return null
  })
  expect(target).toBeTruthy()
  const before = await svg.getAttribute("viewBox")
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: target!.x - 5, y: target!.y }],
  })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, ...target! }],
  })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await expect(svg).toHaveAttribute("viewBox", before!)
  const popup = page.locator(
    '[data-inspection-tooltip]:not([data-tooltip-pinned="true"])'
  )
  await expect(popup).toBeVisible()
  await popup.dispatchEvent("pointerleave", { pointerType: "touch" })
  await expect(popup).toBeVisible()
  const pinButton = popup.getByRole("button", { name: /^Pin / })
  await expect(pinButton).toHaveCSS("width", "44px")
  await expect(pinButton).toHaveCSS("height", "44px")
  await pinButton.tap()
  const pin = page.locator('[data-tooltip-pinned="true"]')
  await expect(pin).toBeVisible()
  const close = pin.getByRole("button", { name: /^Close pinned/ })
  await expect(close).toHaveCSS("width", "44px")
  await close.tap()
  await expect(pin).toHaveCount(0)
  await cdp.detach()
})
