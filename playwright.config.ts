import { defineConfig } from "@playwright/test"
import { portlessName } from "./scripts/portless-name.mjs"

const baseURL =
  process.env.BUILD_TEST_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  `https://${portlessName("exile")}.localhost:${process.env.PORTLESS_PORT ?? 1355}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    ignoreHTTPSErrors: true,
  },
  reporter: "list",
})
