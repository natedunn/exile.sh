import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
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
    CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
  }
  delete result.CONVEX_DEPLOY_KEY
  delete result.CONVEX_DEPLOYMENT_TOKEN
  delete result.CONVEX_SELF_HOSTED_URL
  delete result.CONVEX_SELF_HOSTED_ADMIN_KEY
  delete result.COLLECTOR_ENABLED
  return result
}

export function ensureAnonymousEnvFile(workspaceRoot) {
  const file = anonymousEnvFile(workspaceRoot)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    "# Isolates this worktree from shared Convex deployments.\nCONVEX_AGENT_MODE=anonymous\nCONVEX_DEPLOYMENT=anonymous:anonymous-agent\nCOLLECTOR_ENABLED=false\n"
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

const PORT_PROBE = String.raw`
const net = require("node:net")
const server = net.createServer()
const finish = (code) => {
  server.close(() => process.exit(code))
  setTimeout(() => process.exit(code), 100).unref()
}
server.once("error", () => process.exit(1))
server.listen({ host: "127.0.0.1", port: Number(process.argv[1]), exclusive: true }, () => finish(0))
setTimeout(() => process.exit(2), 1500).unref()
`

function portIsAvailable(port) {
  const result = spawnSync(process.execPath, ["-e", PORT_PROBE, String(port)], {
    stdio: "ignore",
    timeout: 2_000,
  })
  if (result.error && result.error.code !== "ETIMEDOUT") throw result.error
  return result.status === 0
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === "EPERM"
  }
}

function acquirePortLock(cloud, site) {
  const directory = path.join(os.tmpdir(), "exile-convex-port-locks")
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `${cloud}-${site}.lock`)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomUUID()
    try {
      const handle = fs.openSync(file, "wx")
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, token }))
      fs.closeSync(handle)
      return () => {
        try {
          const current = JSON.parse(fs.readFileSync(file, "utf8"))
          if (current.token === token) fs.unlinkSync(file)
        } catch {
          // The lock was already released or replaced.
        }
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error
      try {
        const current = JSON.parse(fs.readFileSync(file, "utf8"))
        if (Number.isInteger(current.pid) && processIsAlive(current.pid)) {
          return null
        }
        fs.unlinkSync(file)
      } catch (readError) {
        if (readError?.code !== "ENOENT") {
          try {
            fs.unlinkSync(file)
          } catch {
            return null
          }
        }
      }
    }
  }
  return null
}

export function reserveWorktreePorts(workspaceRoot) {
  const firstCloudPort = 20000
  const pairCount = 6000
  const offset = hashString(workspaceRoot) % pairCount
  for (let attempt = 0; attempt < pairCount; attempt += 1) {
    const cloud = firstCloudPort + ((offset + attempt) % pairCount) * 2
    const site = cloud + 1
    const release = acquirePortLock(cloud, site)
    if (!release) continue
    if (portIsAvailable(cloud) && portIsAvailable(site)) {
      return { cloud, site, release }
    }
    release()
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
  const ports = config.ports
  if (!Number.isInteger(ports?.cloud) || !Number.isInteger(ports?.site)) {
    throw new Error("Convex local configuration does not contain valid ports.")
  }
  updateEnvFile(path.join(workspaceRoot, ".env.local"), {
    CONVEX_DEPLOYMENT: "anonymous:anonymous-agent",
    VITE_CONVEX_URL: `http://127.0.0.1:${ports.cloud}`,
    VITE_CONVEX_SITE_URL: `http://127.0.0.1:${ports.site}`,
  })
  return ports
}
