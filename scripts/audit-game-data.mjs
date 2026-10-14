import { parseArgs } from "node:util"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { auditGameData, compareAudits } from "./lib/game-data-audit.mjs"

try {
  const { values } = parseArgs({
    options: { root: { type: "string" }, baseline: { type: "string" } },
  })
  const root = resolve(
    values.root ?? fileURLToPath(new URL("../", import.meta.url))
  )
  const candidate = auditGameData(root)
  const report = { ...candidate.output, root }
  if (values.baseline) {
    const baseline = resolve(values.baseline)
    report.baseline = baseline
    report.diff = compareAudits(auditGameData(baseline), candidate)
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n")
} catch (error) {
  console.error(`Data audit failed: ${error.message}`)
  process.exitCode = 1
}
