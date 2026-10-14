import { afterEach, expect, it, vi } from "vitest"
import { dataAssetUrl, resolveDataReferences } from "./data-assets"
import { loadGemKeywords } from "../src/lib/gem-keywords"

afterEach(() => vi.unstubAllGlobals())

it("keeps old and new sessions bound to independent immutable paths", () => {
  const path = "/gems/v1/catalogue.json"
  const old = { "/gems/v1/": "/data-releases/old/gems/v1/" }
  const next = { "/gems/v1/": "/data-releases/new/gems/v1/" }
  expect(dataAssetUrl(path, old)).toBe(
    "/data-releases/old/gems/v1/catalogue.json"
  )
  expect(dataAssetUrl(path, next)).toBe(
    "/data-releases/new/gems/v1/catalogue.json"
  )
  const value = {
    image: "/gems/v1/icons/icon.webp",
    lines: ["5 damage"],
    url: "https://repoe-fork.github.io/poe2/example",
  }
  expect(resolveDataReferences(value, next)).toEqual({
    ...value,
    image: "/data-releases/new/gems/v1/icons/icon.webp",
  })
  expect(value.image).toBe("/gems/v1/icons/icon.webp")
  expect(resolveDataReferences(value, next).lines).toBe(value.lines)
  expect(
    resolveDataReferences(
      { nodes: [{ id: "1", x: 3, stats: ["5 Life"] }] },
      next
    )
  ).toEqual({ nodes: [{ id: "1", x: 3, stats: ["5 Life"] }] })
  expect(dataAssetUrl("/gems/spark", next)).toBe("/gems/spark")
  expect(dataAssetUrl("/data-releases/old/gems/v1/catalogue.json", next)).toBe(
    "/data-releases/old/gems/v1/catalogue.json"
  )
})

it("uses frozen keyword definitions without any live request", async () => {
  const requests: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      requests.push(path)
      return Response.json(
        path.endsWith("/keywords.json")
          ? {
              keywords: {
                Shock: { term: "Shock", definition: "Pinned definition" },
              },
            }
          : { aliases: { shock: "Shock" }, descriptions: {} }
      )
    })
  )
  expect((await loadGemKeywords()).keywords.Shock?.definition).toBe(
    "Pinned definition"
  )
  expect(requests.sort()).toEqual([
    "/gems/v1/keyword-aliases.json",
    "/gems/v1/keywords.json",
  ])
})

it("failed keyword assets never fall through to a mutable external source", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 503 }))
  vi.stubGlobal("fetch", fetcher)
  await expect(loadGemKeywords()).rejects.toThrow(
    "Keyword reference returned 503"
  )
  expect(fetcher.mock.calls.length).toBe(2)
})
