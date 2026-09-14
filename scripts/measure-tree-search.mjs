import { chromium } from "@playwright/test"

const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(
    `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4174"}/trees/passive`
  )
  await page.getByRole("button", { name: "Search tree", exact: true }).click()
  const input = page.getByRole("textbox", { name: "Search nodes" })
  await input.focus()
  await page.evaluate(() => {
    window.searchFrameSamples = []
    document
      .querySelector('[aria-label="Search nodes"]')
      .addEventListener("input", () => {
        const start = performance.now()
        requestAnimationFrame(() =>
          window.searchFrameSamples.push(performance.now() - start)
        )
      })
  })
  await input.pressSequentially("increased", { delay: 60 })
  await page
    .getByRole("status")
    .filter({ hasText: /^\d+ matching nodes$/ })
    .waitFor()
  const report = await page.evaluate(() => ({
    inputToFrameMs: window.searchFrameSamples,
    matchingNodes: Number(
      document.querySelector(".tree-search-results").dataset.resultCount
    ),
    mountedResultButtons: document.querySelectorAll(
      ".tree-search-results button"
    ).length,
    highlightPaths: document.querySelectorAll(".tree-search-highlights path")
      .length,
  }))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
