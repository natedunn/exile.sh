import { describe, expect, it } from "vitest"
import { createReferenceAssetReader } from "../src/lib/reference-asset-reader"
import { parseDataSelection } from "./data-assets"
import type { DataSelection } from "./data-assets"

const selection = (id: string): DataSelection => ({
  schemaVersion: 1,
  releaseId: id,
  prefixes: { "/gems/": `/data-releases/${id}/gems/` },
  releases: { gems: id },
})
function fixture() {
  const calls: string[] = []
  const reader = createReferenceAssetReader(async (path) => {
    calls.push(path)
    if (path === "/data-releases/old/selection.json")
      return Response.json(selection("old"))
    if (path.endsWith("selection.json") || path.includes("missing"))
      return new Response(null, { status: 404 })
    const version = path.includes("/new/")
      ? "new"
      : path.includes("/old/")
        ? "old"
        : "legacy"
    return Response.json({ version, image: "/gems/art.webp" })
  }, selection("new"))
  return { reader, calls }
}

describe("server reference snapshots", () => {
  it("keeps metadata, effects and embedded art on each client's selection", async () => {
    const { reader, calls } = fixture()
    for (const id of ["old", "new", "legacy"]) {
      const image =
        id === "legacy"
          ? "/gems/art.webp"
          : `/data-releases/${id}/gems/art.webp`
      for (const path of ["/gems/catalogue.json", "/gems/effects/fire.json"])
        expect(await reader.json(path, id)).toEqual({ version: id, image })
    }
    expect(calls.filter((path) => path.endsWith("selection.json"))).toEqual([
      "/data-releases/old/selection.json",
    ])
  })
  it("fails closed when an archived selection is unavailable", async () => {
    const { reader, calls } = fixture()
    await expect(reader.json("/gems/catalogue.json", "absent")).rejects.toThrow(
      "snapshot unavailable"
    )
    expect(calls).toEqual(["/data-releases/absent/selection.json"])
  })
  it("allows optional missing effects but rejects missing required data", async () => {
    const { reader } = fixture()
    expect(
      await reader.json("/gems/missing-effect.json", "new", true)
    ).toBeNull()
    await expect(
      reader.json("/gems/missing-effect.json", "new")
    ).rejects.toThrow("404")
  })
  it("rejects external and traversing archived prefixes", () => {
    for (const [prefix, target] of [
      ["/gems/", "https://example.com/gems/"],
      ["/../", "/data-releases/old/../"],
    ])
      expect(() =>
        parseDataSelection(
          { ...selection("old"), prefixes: { [prefix]: target } },
          "old"
        )
      ).toThrow("prefix")
  })
})
