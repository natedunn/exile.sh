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
    const svg = page.locator(".tree-viewport svg")
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
