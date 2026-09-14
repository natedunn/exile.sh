// Isolated Chrome SVG memory measurement. No application changes or full test suite.
// Usage: TREE_MEMORY_RUNS=3 node scripts/measure-tree-memory.mjs /tmp/tree-memory.json
import { chromium, expect } from "@playwright/test"
import { writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
const origin = new URL(
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173"
).origin
const profiles = [
  { name: "mobile-2x", width: 360, height: 740, dpr: 2 },
  { name: "mobile-3x", width: 390, height: 844, dpr: 3 },
  { name: "desktop-2x", width: 1440, height: 900, dpr: 2 },
].filter(
  (p) =>
    !process.env.TREE_MEMORY_PROFILE ||
    p.name === process.env.TREE_MEMORY_PROFILE
)
const output = process.argv[2] || "/tmp/tree-memory.json"
const results = []
const runs = Number(process.env.TREE_MEMORY_RUNS || 3)
const compareRegions = process.env.TREE_MEMORY_COMPARE_REGIONS === "1"
const hex = (value) => (value === undefined ? null : parseInt(value, 16))

for (const profile of profiles)
  for (
    let run = Number(process.env.TREE_MEMORY_START_RUN || 0);
    run < runs;
    run++
  )
    for (const variant of compareRegions
      ? run % 2
        ? ["regions", "ungrouped"]
        : ["ungrouped", "regions"]
      : ["regions"]) {
      if (
        process.env.TREE_MEMORY_VARIANT &&
        variant !== process.env.TREE_MEMORY_VARIANT
      )
        continue
      // Each run has its own browser, GPU process and blank baseline.
      const renderer = "svg"
      const browser = await chromium.launch({ channel: "chrome" })
      try {
        const context = await browser.newContext({
          viewport: { width: profile.width, height: profile.height },
          deviceScaleFactor: profile.dpr,
        })
        let sourceHash
        let transformedModules = 0
        if (compareRegions) {
          // Test-only control: preserve the current renderer and hover isolation,
          // but restore per-node visibility and one memoized node/artwork group.
          // Both variants use interception so routing/cache behavior is matched.
          await context.route(
            "**/src/components/passive-tree.tsx*",
            async (route) => {
              const response = await route.fetch()
              let body = await response.text()
              sourceHash = createHash("sha256").update(body).digest("hex")
              if (variant === "ungrouped") {
                const replacements = [
                  [
                    "treeNodeRegions(data.nodes)",
                    '[{ id: "ungrouped", nodes: data.nodes, bounds: {} }]',
                  ],
                  [
                    "regions.filter((region) => overlapsTreeRect(region.bounds, renderRect))",
                    '[{ id: "ungrouped", nodes: data.nodes.filter((node) => node.x >= renderRect.minX && node.x <= renderRect.maxX && node.y >= renderRect.minY && node.y <= renderRect.maxY), bounds: {} }]',
                  ],
                ]
                for (const [from, to] of replacements) {
                  if (body.split(from).length !== 2)
                    throw new Error(
                      "Memory control transform no longer matches: " + from
                    )
                  body = body.replace(from, to)
                }
              }
              transformedModules++
              await route.fulfill({ response, body })
            }
          )
        }
        const page = await context.newPage()
        const pageCdp = await context.newCDPSession(page)
        const cdp = await browser.newBrowserCDPSession()
        const errors = []
        page.on("pageerror", (error) => errors.push(error.message))
        page.on("crash", () => errors.push("Page crashed"))
        const stages = []
        async function snapshot(stage) {
          await pageCdp.send("HeapProfiler.collectGarbage")
          await page.waitForTimeout(150)
          const events = []
          const collect = (e) => events.push(...e.value)
          cdp.on("Tracing.dataCollected", collect)
          await cdp.send("Tracing.start", {
            transferMode: "ReportEvents",
            traceConfig: {
              includedCategories: ["disabled-by-default-memory-infra"],
              memoryDumpConfig: { triggers: [] },
            },
          })
          const dump = await cdp.send("Tracing.requestMemoryDump", {
            deterministic: true,
            levelOfDetail: "light",
          })
          const done = new Promise((resolve) =>
            cdp.once("Tracing.tracingComplete", resolve)
          )
          await cdp.send("Tracing.end")
          await done
          cdp.off("Tracing.dataCollected", collect)
          if (!dump.success) throw new Error("Chrome memory dump failed")
          const processes = new Map(
            (await cdp.send("SystemInfo.getProcessInfo")).processInfo.map(
              (p) => [p.id, p.type]
            )
          )
          const footprints = new Map()
          for (const event of events) {
            const totals = event.args?.dumps?.process_totals
            if (totals?.private_footprint_bytes !== undefined)
              footprints.set(event.pid, {
                pid: event.pid,
                type: processes.get(event.pid) || "other",
                privateBytes: hex(totals.private_footprint_bytes),
              })
          }
          if (!footprints.size)
            throw new Error("No private-footprint data in memory dump")
          const heap = await pageCdp.send("Runtime.getHeapUsage")
          const dom = await pageCdp.send("Memory.getDOMCounters")
          const svg = await page.evaluate(() => {
            const map = document.querySelector(".tree-viewport svg")
            return {
              elements: map?.querySelectorAll("*").length || 0,
              nodes: map?.querySelectorAll("[data-node]").length || 0,
              images: map?.querySelectorAll("image").length || 0,
              regions: map?.querySelectorAll("[data-tree-region]").length || 0,
              viewBox: map?.getAttribute("viewBox") || null,
            }
          })
          const total = [...footprints.values()].reduce(
            (sum, p) => sum + p.privateBytes,
            0
          )
          const gpu = [...footprints.values()]
            .filter((p) => p.type === "GPU")
            .reduce((sum, p) => sum + p.privateBytes, 0)
          const renderers = [...footprints.values()]
            .filter((p) => p.type === "renderer")
            .reduce((sum, p) => sum + p.privateBytes, 0)
          const sample = {
            stage,
            privateBytes: total,
            gpuPrivateBytes: gpu,
            rendererPrivateBytes: renderers,
            heap,
            dom,
            svg,
            processes: [...footprints.values()],
          }
          stages.push(sample)
          console.log(
            JSON.stringify({
              profile: profile.name,
              run,
              renderer,
              variant,
              stage,
              privateMiB: Math.round(total / 1048576),
              gpuMiB: Math.round(gpu / 1048576),
              heapMiB: Math.round(heap.usedSize / 1048576),
            })
          )
        }
        await snapshot("blank")
        await page.goto(`${origin}/trees/passive`)
        const map = page.locator(".tree-viewport svg")
        await expect(map).toBeVisible()
        await page.waitForTimeout(300)
        if (compareRegions) {
          if (transformedModules !== 1)
            throw new Error("Expected one intercepted renderer module")
          const regionCount = await map.locator("[data-tree-region]").count()
          if (variant === "ungrouped") expect(regionCount).toBe(1)
          else expect(regionCount).toBeGreaterThan(1)
        }
        await snapshot("overview")
        for (let i = 0; i < 3; i++)
          await page
            .getByRole("button", { name: "Zoom in", exact: true })
            .click()
        async function artReady() {
          await expect(page.locator(".tree-passive-art").first()).toBeAttached()
          await page.waitForLoadState("networkidle")
          await page.waitForTimeout(100)
        }
        await artReady()
        await snapshot("zoomed")
        async function explore(repeats = 6) {
          const box = await map.boundingBox()
          // Traverse both axes, then return. Repeat identical traversal to check
          // whether memory keeps growing after caches have warmed.
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ])
            for (let repeat = 0; repeat < repeats; repeat++) {
              const x =
                box.x + box.width * (dx > 0 ? 0.12 : dx < 0 ? 0.88 : 0.5)
              const y =
                box.y + box.height * (dy > 0 ? 0.15 : dy < 0 ? 0.85 : 0.5)
              await page.mouse.move(x, y)
              await page.mouse.down()
              await page.mouse.move(
                x + dx * box.width * 0.76,
                y + dy * box.height * 0.7,
                { steps: 8 }
              )
              await page.mouse.up()
            }
          await page.mouse.move(0, 0)
          await artReady()
        }
        await explore()
        await snapshot("explored-once")
        await explore()
        await snapshot("explored-twice")
        await explore()
        await snapshot("explored-thrice")
        for (let i = 0; i < 2; i++)
          await page
            .getByRole("button", { name: "Zoom in", exact: true })
            .click()
        await artReady()
        await snapshot("high-zoomed")
        await explore(12)
        await snapshot("high-explored-once")
        await explore(12)
        await snapshot("high-explored-twice")
        await explore(12)
        await snapshot("high-explored-thrice")
        let pressureSimulation
        try {
          await pageCdp.send("Memory.simulatePressure", { level: "moderate" })
          pressureSimulation = { supported: true }
          await page.waitForTimeout(500)
          await snapshot("moderate-pressure")
        } catch (error) {
          pressureSimulation = { supported: false, error: error.message }
          console.log(
            JSON.stringify({
              profile: profile.name,
              run,
              renderer,
              variant,
              pressureSimulation,
            })
          )
        }
        // SPA navigation really unmounts the large viewer without creating a
        // fresh document. React Query intentionally retains version data/art URLs.
        await page
          .getByRole("navigation", { name: "Tree types" })
          .getByRole("link", { name: "Ascendancy Trees", exact: true })
          .click()
        await expect(
          page.locator('.passive-tree[data-mode="ascendancy"]')
        ).toBeVisible()
        await page.waitForLoadState("networkidle")
        await snapshot("unmounted")
        await page.waitForTimeout(1000)
        await snapshot("unmounted-settled")
        results.push({
          profile,
          run,
          renderer,
          variant,
          compareRegions,
          sourceHash,
          transformedModules,
          browser: await browser.version(),
          stages,
          pressureSimulation,
          errors,
        })
        writeFileSync(output, JSON.stringify(results, null, 2) + "\n")
        if (errors.length) throw new Error(errors.join("\n"))
      } finally {
        await browser.close()
      }
    }
