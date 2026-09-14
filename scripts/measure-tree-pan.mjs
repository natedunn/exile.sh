// Run against the same server/browser before and after a renderer change.
// Usage: node scripts/measure-tree-pan.mjs /tmp/tree-pan-baseline.json
import { chromium, expect } from "@playwright/test"
import { writeFileSync } from "node:fs"
const browser = await chromium.launch({ channel: "chrome" })
const results = []
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: Number(process.env.TREE_PERF_DPR || 1),
  })
  await page.goto(
    process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173/trees/passive"
  )
  const svg = page.locator(".tree-viewport svg")
  await expect(svg).toBeVisible()
  for (const zoomClicks of (process.env.TREE_PERF_ZOOM_CLICKS || "3,5")
    .split(",")
    .map(Number)) {
    for (let run = 0; run < Number(process.env.TREE_PERF_RUNS || 3); run++) {
      await page.getByRole("button", { name: "Reset", exact: true }).click()
      for (let i = 0; i < zoomClicks; i++)
        await page.getByRole("button", { name: "Zoom in", exact: true }).click()
      await expect(page.locator(".tree-passive-art").first()).toBeAttached()
      await page.waitForTimeout(400)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: Number(process.env.TREE_PERF_CPU || 1),
      })
      const trace = []
      cdp.on("Tracing.dataCollected", (e) => trace.push(...e.value))
      await cdp.send("Tracing.start", {
        categories: "devtools.timeline",
        transferMode: "ReportEvents",
      })
      await page.evaluate(() => {
        window.panFrames = []
        window.panRunning = true
        let previous = performance.now()
        const tick = (now) => {
          if (!window.panRunning) return
          window.panFrames.push(now - previous)
          previous = now
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      const box = await svg.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      const start = performance.now()
      for (let i = 0; i < 120; i++)
        await page.mouse.move(
          box.x +
            box.width / 2 +
            Math.sin(i / 20) * Number(process.env.TREE_PERF_DISTANCE || 280),
          box.y + box.height / 2 + Math.cos(i / 20) * 100
        )
      await page.mouse.up()
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      )
      const elapsed = performance.now() - start
      const frames = await page.evaluate(() => {
        window.panRunning = false
        return window.panFrames.slice(1).sort((a, b) => a - b)
      })
      const ended = new Promise((r) => cdp.once("Tracing.tracingComplete", r))
      await cdp.send("Tracing.end")
      await ended
      if (process.env.TREE_PERF_TRACE)
        writeFileSync(process.env.TREE_PERF_TRACE, JSON.stringify(trace))
      const totals = {}
      for (const e of trace)
        if (e.ph === "X" && e.dur)
          totals[e.name] = (totals[e.name] || 0) + e.dur / 1000
      results.push({
        panDistance: Number(process.env.TREE_PERF_DISTANCE || 280),
        deviceScaleFactor: Number(process.env.TREE_PERF_DPR || 1),
        cpuThrottle: Number(process.env.TREE_PERF_CPU || 1),
        renderer: "svg",
        zoom: 1.5 ** zoomClicks,
        run,
        elapsedMs: Math.round(elapsed),
        frameCount: frames.length,
        frameMaxMs: Math.round(frames.at(-1) * 10) / 10,
        frameP99Ms:
          Math.round(frames[Math.floor(frames.length * 0.99)] * 10) / 10,
        frameP95Ms:
          Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
        framesOver25Ms: frames.filter((x) => x > 25).length,
        elements: await svg.locator("*").count(),
        images: await svg.locator("image").count(),
        timingMs: Object.fromEntries(
          [
            "FunctionCall",
            "UpdateLayoutTree",
            "Layout",
            "PrePaint",
            "Paint",
          ].map((k) => [k, Math.round(totals[k] || 0)])
        ),
      })
      console.log(JSON.stringify(results.at(-1)))
      await cdp.detach()
    }
  }
} finally {
  await browser.close()
}
writeFileSync(
  process.argv[2] || "/tmp/tree-pan.json",
  JSON.stringify(results, null, 2) + "\n"
)
console.log(JSON.stringify(results))
