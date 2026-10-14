import { parseArgs } from "node:util"
import { resolve, dirname, join } from "node:path"
import {
  captureSources,
  generateCandidate,
  testCandidate,
  draftCapturePlan,
} from "./lib/data-pipeline.mjs"
import {
  checkCandidate,
  preparePublication,
  sourceGroups,
  verifySelectedRelease,
  rollbackSelection,
} from "./lib/data-acceptance.mjs"
import { readJson, writeJson } from "./lib/data-pipeline-files.mjs"

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      config: { type: "string" },
      out: { type: "string" },
      capture: { type: "string" },
      candidate: { type: "string" },
      baseline: { type: "string" },
      review: { type: "string" },
      checkout: { type: "string" },
      python: { type: "string" },
      id: { type: "string" },
      patch: { type: "string" },
      official: { type: "string" },
      features: { type: "string" },
      pob: { type: "string" },
      trees: { type: "string" },
      release: { type: "string" },
    },
  })
  const need = (key) => {
    if (!values[key]) throw new Error(`--${key} required`)
    return resolve(values[key])
  }
  const [command] = positionals
  let result
  if (command === "plan") {
    const plan = draftCapturePlan({
      releaseId: values.id,
      targetPatch: values.patch,
      officialUrl: values.official,
      features: values.features?.split(",") ?? [],
      pobRevision: values.pob,
      treeVersions: values.trees?.split(",") ?? [],
      baseline: values.baseline,
    })
    const path = need("out")
    if ((await import("node:fs")).existsSync(path))
      throw new Error("Plan already exists; choose a new path")
    writeJson(path, plan)
    result = {
      plan: path,
      sources: plan.sources.length,
      note: "Review and extend this inventory before capture; no readiness inferred.",
    }
  } else if (command === "capture") {
    const path = need("config")
    result = await captureSources(readJson(path), need("out"), {
      base: dirname(path),
    })
  } else if (command === "generate")
    result = generateCandidate(need("capture"), need("out"), {
      baseline: values.baseline,
      python: values.python,
    })
  else if (command === "test") result = testCandidate(need("candidate"))
  else if (command === "check")
    result = checkCandidate(
      need("candidate"),
      values.review ? resolve(values.review) : undefined
    )
  else if (command === "prepare")
    result = preparePublication(need("candidate"), {
      checkout: values.checkout,
      reviewPath: values.review ? resolve(values.review) : undefined,
    })
  else if (command === "verify")
    result = verifySelectedRelease(
      values.checkout ? resolve(values.checkout) : undefined
    )
  else if (command === "rollback")
    result = rollbackSelection(
      values.release,
      values.checkout ? resolve(values.checkout) : undefined
    )
  else if (command === "groups")
    result = sourceGroups(readJson(join(need("candidate"), "candidate.json")))
  else
    throw new Error(
      "Use capture, generate, test, groups, check, prepare or verify. See docs/game-data-updates.md."
    )
  let summary = result
  if (command === "generate")
    summary = {
      candidateFingerprint: result.fingerprint,
      targetPatch: result.config.targetPatch,
      issueCount: result.issues.length,
    }
  if (command === "capture")
    summary = {
      captureFingerprint: result.fingerprint,
      sources: result.sources.length,
    }
  if (command === "prepare")
    summary = {
      releaseId: result.releaseId,
      targetPatch: result.targetPatch,
      features: result.features,
      candidateFingerprint: result.candidateFingerprint,
      recordPath: `data/releases/${result.releaseId}.json`,
      assetFiles: Object.keys(result.files).length,
    }
  if (command === "check") {
    const report = join(need("candidate"), "check.json")
    writeJson(report, result)
    summary = {
      ready: result.ready,
      blockerCount: result.blockers.length,
      blockers: result.blockers.slice(0, 20),
      report,
    }
  }
  console.log(JSON.stringify(summary, null, 2))
  if (result.ready === false) process.exitCode = 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
