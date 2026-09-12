import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

import { previewName } from "./preview-name.mjs"

export const PRODUCTION = "brilliant-rooster-193"
export const PREVIEW_KEY_PREFIX = "preview:nate-dunn:exile-sh|"

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
  const preview = previewName(branch)
  const key = production
    ? env.CONVEX_PROD_DEPLOY_KEY
    : env.CONVEX_PREVIEW_DEPLOY_KEY
  if (
    production &&
    (!key?.startsWith(`prod:${PRODUCTION}|`) || !key.split("|")[1])
  ) {
    throw new Error(
      `Set CONVEX_PROD_DEPLOY_KEY to the production deploy key for ${PRODUCTION}.`
    )
  }
  if (
    !production &&
    (!key?.startsWith(PREVIEW_KEY_PREFIX) || !key.split("|")[1])
  ) {
    throw new Error(
      "Set CONVEX_PREVIEW_DEPLOY_KEY to the preview deploy key for nate-dunn/exile-sh."
    )
  }

  // Only the Convex deploy subprocess receives its scoped credential. The
  // nested Vite command strips it again in cloudflare-vite-build.mjs.
  const publicEnv = { ...env }
  for (const key of Object.keys(publicEnv))
    if (key.startsWith("CONVEX_") && /KEY|TOKEN|DEPLOYMENT/.test(key))
      delete publicEnv[key]
  delete publicEnv.VITE_CONVEX_URL
  delete publicEnv.VITE_CONVEX_SITE_URL
  publicEnv.VITE_SITE_URL = production
    ? "https://exile.sh"
    : (env.VITE_SITE_URL_PREVIEW ??
      `https://${preview}-exile-sh.hello-fc8.workers.dev`)
  const deployEnv = { ...publicEnv, CONVEX_DEPLOY_KEY: key }
  const deployArgs = [
    "kitcn",
    "deploy",
    "--cmd",
    "node scripts/cloudflare-vite-build.mjs",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
  ]

  if (!production) {
    console.log(
      `Preview ${branch}: deploy isolated Convex preview '${preview}', then build the Worker.`
    )
    run(
      [...deployArgs, "--preview-name", preview, "--preview-run", "seed:local"],
      deployEnv
    )
    return
  }

  console.log(
    `Production ${branch}: build and deploy Convex ${PRODUCTION} before publishing the Worker.`
  )
  run(deployArgs, deployEnv)
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
