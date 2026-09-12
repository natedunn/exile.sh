import { spawnSync } from "node:child_process"

const convexUrl = process.env.VITE_CONVEX_URL
if (!convexUrl) throw new Error("VITE_CONVEX_URL was not provided by Convex.")

const publicEnv = { ...process.env }
for (const key of Object.keys(publicEnv)) {
  if (key.startsWith("CONVEX_") && /KEY|TOKEN|DEPLOYMENT/.test(key)) {
    delete publicEnv[key]
  }
}
publicEnv.VITE_CONVEX_SITE_URL = convexUrl.replace(
  /\.convex\.cloud$/,
  ".convex.site"
)

const result = spawnSync("bun", ["x", "vite", "build"], {
  env: publicEnv,
  stdio: "inherit",
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
