import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { configureLocalAuthOrigin } from "./lib/auth-env.mjs"

test("worktree startup replaces copied origins while retaining credentials and backend URLs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "exile-auth-env-"))
  try {
    fs.mkdirSync(path.join(root, "convex"))
    fs.writeFileSync(
      path.join(root, "convex/.env"),
      "# private\nSITE_URL=https://exile.sh\nexport SITE_URL = https://stale.example\nDISCORD_CLIENT_SECRET=test-only\nBETTER_AUTH_SECRET=test-only\n"
    )
    fs.writeFileSync(
      path.join(root, ".env.local"),
      "VITE_SITE_URL=https://old.localhost:1355\nVITE_CONVEX_URL=http://127.0.0.1:3210\n"
    )
    const expected = "https://new-exile.localhost:1444"
    assert.equal(configureLocalAuthOrigin(root, "new-exile", 1444), expected)
    const auth = fs.readFileSync(path.join(root, "convex/.env"), "utf8")
    assert.ok(auth.includes(`SITE_URL=${expected}`))
    assert.equal(auth.match(/SITE_URL/g)?.length, 1)
    assert.ok(!auth.includes("stale.example"))
    assert.ok(auth.includes("DISCORD_CLIENT_SECRET=test-only"))
    assert.ok(auth.includes("BETTER_AUTH_SECRET=test-only"))
    assert.ok(
      fs
        .readFileSync(path.join(root, ".env.local"), "utf8")
        .includes("VITE_CONVEX_URL=http://127.0.0.1:3210")
    )
    configureLocalAuthOrigin(root, "new-exile", 1444)
    assert.equal(fs.readFileSync(path.join(root, "convex/.env"), "utf8"), auth)
    assert.throws(() => configureLocalAuthOrigin(root, "host\nBAD=1", 1444))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
