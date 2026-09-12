import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export function currentBranch(env = process.env) {
  const configured =
    env.WORKERS_CI_BRANCH ??
    env.CF_BRANCH ??
    env.CF_PAGES_BRANCH ??
    env.CLOUDFLARE_BRANCH ??
    env.GITHUB_HEAD_REF ??
    env.GITHUB_REF_NAME ??
    env.BRANCH
  if (configured) return configured

  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return "preview"
  }
}

export function previewName(branch, maxLength = 40) {
  const name = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/g, "")
  return name || "preview"
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(previewName(process.argv[2] ?? currentBranch()))
}
