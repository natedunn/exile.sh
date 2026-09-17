import path from "node:path"
import { updateEnvFile } from "./local-convex.mjs"

/** Keep copied credentials, but derive the frontend origin for this worktree. */
export function configureLocalAuthOrigin(root, routeName, port) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(routeName))
    throw new Error("Invalid Portless route")
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid Portless port")
  const origin = `https://${routeName}.localhost:${port}`
  updateEnvFile(path.join(root, "convex/.env"), { SITE_URL: origin })
  updateEnvFile(path.join(root, ".env.local"), { VITE_SITE_URL: origin })
  return origin
}
