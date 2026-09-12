import { spawn } from "node:child_process"
import net from "node:net"
import os from "node:os"
import path from "node:path"

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port })
    const finish = (connected) => {
      socket.destroy()
      resolve(connected)
    }
    socket.setTimeout(1_000, () => finish(false))
    socket.once("connect", () => finish(true))
    socket.once("error", () => finish(false))
  })
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function portlessCli(workspaceRoot) {
  return path.join(workspaceRoot, "node_modules", "portless", "dist", "cli.js")
}

export async function ensurePortlessProxy(workspaceRoot, port) {
  if (await canConnect(port)) return
  const proxy = spawn(
    process.execPath,
    [portlessCli(workspaceRoot), "proxy", "start", "--https", "--skip-trust"],
    {
      cwd: os.tmpdir(),
      detached: true,
      stdio: "ignore",
    }
  )
  proxy.unref()

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await delay(300)
    if (await canConnect(port)) return
  }
  throw new Error(`Portless proxy did not start on port ${port}.`)
}
