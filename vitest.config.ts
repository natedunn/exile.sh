import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["shared/**/*.test.ts", "convex/**/*.test.ts"],
  },
})
