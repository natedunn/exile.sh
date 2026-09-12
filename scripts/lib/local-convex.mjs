import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export function anonymousEnvFile(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "anonymous.env")
}

export function localConfigFile(workspaceRoot) {
  return path.join(workspaceRoot, ".convex", "local", "default", "config.json")
}

export function anonymousConvexEnv(env = process.env) {
  const result = {
    ...env,
    CONVEX_AGENT_MODE: "anonymous",
    CONVEX_DEPLOYMENT: "anonymous-agent",
  }
  delete result.CONVEX_DEPLOY_KEY
  delete result.CONVEX_DEPLOYMENT_TOKEN
  delete result.CONVEX_SELF_HOSTED_URL
  delete result.CONVEX_SELF_HOSTED_ADMIN_KEY
  return result
}

export function ensureAnonymousEnvFile(workspaceRoot) {
  const file = anonymousEnvFile(workspaceRoot)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    "# Isolates this worktree from shared Convex deployments.\nCONVEX_DEPLOYMENT=anonymous-agent\n"
  )
  return file
}

function hashString(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function portIsAvailable(port) {
  if (process.platform === "win32") return true
  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  return result.status !== 0 || !result.stdout.trim()
}

export function resolvePorts(workspaceRoot) {
  const firstCloudPort = 20000
  const pairCount = 6000
  const offset = hashString(workspaceRoot) % pairCount
  for (let attempt = 0; attempt < pairCount; attempt += 1) {
    const cloud = firstCloudPort + ((offset + attempt) % pairCount) * 2
    const site = cloud + 1
    if (portIsAvailable(cloud) && portIsAvailable(site)) return { cloud, site }
  }
  throw new Error("Could not find an available local Convex port pair.")
}

function updateEnvFile(file, values) {
  const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  const lines = original === "" ? [] : original.split(/\r?\n/)
  const remaining = new Map(Object.entries(values))
  const updated = lines.map((line) => {
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/)
    if (!match || !remaining.has(match[1])) return line
    const value = remaining.get(match[1])
    remaining.delete(match[1])
    return `${match[1]}=${value}`
  })
  for (const [key, value] of remaining) updated.push(`${key}=${value}`)
  while (updated.at(-1) === "") updated.pop()
  const next = `${updated.join("\n")}\n`
  if (next !== original) fs.writeFileSync(file, next)
}

export function configureWorktreePorts(workspaceRoot) {
  const configFile = localConfigFile(workspaceRoot)
  if (!fs.existsSync(configFile)) return null
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"))
  const configured = config.ports
  const ports = resolvePorts(workspaceRoot)
  if (configured?.cloud !== ports.cloud || configured?.site !== ports.site) {
    config.ports = { ...configured, ...ports }
    fs.writeFileSync(configFile, `${JSON.stringify(config)}\n`)
  }
  updateEnvFile(path.join(workspaceRoot, ".env.local"), {
    CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
    VITE_CONVEX_URL: `http://127.0.0.1:${ports.cloud}`,
    VITE_CONVEX_SITE_URL: `http://127.0.0.1:${ports.site}`,
  })
  return ports
}

export function localBackendPids(workspaceRoot) {
  const configFile = localConfigFile(workspaceRoot)
  if (!fs.existsSync(configFile) || process.platform === "win32") return []
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"))
  const port = config.ports?.cloud
  if (!Number.isInteger(port)) return []
  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  if (result.status !== 0) return []
  return result.stdout
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isInteger)
    .filter((pid) => {
      const command = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      return command.stdout?.includes(path.dirname(configFile))
    })
}

export function stopLocalBackend(workspaceRoot) {
  const pids = localBackendPids(workspaceRoot)
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      // Already stopped.
    }
  }
  if (pids.length === 0) return

  const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && localBackendPids(workspaceRoot).length > 0) {
    Atomics.wait(sleepBuffer, 0, 0, 100)
  }

  for (const pid of localBackendPids(workspaceRoot)) {
    try {
      process.kill(pid, "SIGKILL")
    } catch {
      // Already stopped.
    }
  }
}
