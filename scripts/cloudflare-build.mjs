import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export const PRODUCTION = "brilliant-rooster-193"
export const DEVELOPMENT = "next-axolotl-199"

function command(args, env, capture = false) {
  const result = spawnSync("bun", ["x", ...args], {
    env,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  })
  if (result.error || result.status !== 0)
    throw new Error(`Command failed: ${args[0]} ${args[1]}`)
  return result.stdout?.trim() ?? ""
}

export function build(env = process.env, run = command) {
  const branch = env.WORKERS_CI_BRANCH
  if (!branch)
    throw new Error("WORKERS_CI_BRANCH is required; use bun run build locally.")
  const production = branch === "main"
  const target = production ? PRODUCTION : DEVELOPMENT
  // Do not pass deployment credentials to Vite or to preview build commands.
  const publicEnv = { ...env }
  for (const key of Object.keys(publicEnv))
    if (key.startsWith("CONVEX_") && /KEY|TOKEN|DEPLOYMENT/.test(key))
      delete publicEnv[key]
  publicEnv.VITE_CONVEX_URL = `https://${target}.convex.cloud`
  publicEnv.VITE_CONVEX_SITE_URL = `https://${target}.convex.site`
  publicEnv.VITE_SITE_URL = production
    ? "https://exile.sh"
    : (env.VITE_SITE_URL_PREVIEW ?? "https://exile-sh.hello-fc8.workers.dev")

  if (!production) {
    console.log(
      `Preview ${branch}: build against dev (${target}); no backend deployment.`
    )
    run(["vite", "build"], publicEnv)
    return
  }
  const key = env.CONVEX_PROD_DEPLOY_KEY
  if (!key?.startsWith(`prod:${PRODUCTION}|`) || !key.split("|")[1])
    throw new Error(
      `Set CONVEX_PROD_DEPLOY_KEY to the production deploy key for ${PRODUCTION}.`
    )

  // Compile first. A frontend build failure must not update the backend.
  run(["vite", "build"], publicEnv)
  const deployEnv = { ...publicEnv, CONVEX_DEPLOY_KEY: key }
  console.log(
    `target: prod (${PRODUCTION}) — deploy Convex before publishing the Worker.`
  )
  run(["kitcn", "deploy"], deployEnv)
  const names = run(
    ["convex", "env", "list", "--names-only"],
    deployEnv,
    true
  ).split(/\s+/)
  if (!names.includes("COLLECTOR_ENABLED"))
    run(["convex", "env", "set", "COLLECTOR_ENABLED", "true"], deployEnv)
  // Respect an operator's explicit false; never restart a paused collector on deploy.
  const enabled = run(
    ["convex", "env", "get", "COLLECTOR_ENABLED"],
    deployEnv,
    true
  )
  if (enabled !== "true") {
    console.log("Collector is explicitly paused; leaving it paused.")
    return
  }
  const result = JSON.parse(
    run(["convex", "run", "ingestion:ingest", "{}"], deployEnv, true)
  )
  if (result.status === "error")
    throw new Error(`Initial collection failed: ${result.message}`)
  console.log(
    `Collector: ${result.status}. Remaining history runs in Convex, independently of this build.`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    build()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
