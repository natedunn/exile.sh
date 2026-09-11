import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { deflateSync, gzipSync, strToU8, zlibSync } from "fflate"
import {
  decodeCode,
  parseBuild,
  parseBuildXml,
  displayStat,
  pobbinRawUrl,
  MAX_XML_BYTES,
} from "./pob"

const fixtures = new URL("./fixtures/pob/", import.meta.url)
const encode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
const empty =
  '<PathOfBuilding2><Build level="1" className="Warrior" ascendClassName="None"/><Tree/><Skills/><Items/></PathOfBuilding2>'
describe("real PoE2 exports", () => {
  for (const file of readdirSync(fixtures).filter((f) => f.endsWith(".txt")))
    test(file, () => {
      const code = readFileSync(new URL(file, fixtures), "utf8")
      const build = parseBuild(code)
      expect(build.stats.length).toBeGreaterThan(90)
      expect(build.level).toBeGreaterThan(0)
      expect(build.treeSpecs.length).toBeGreaterThan(0)
      expect(build.skillSets.length).toBeGreaterThan(0)
      expect(parseBuild(encode(zlibSync(strToU8(decodeCode(code)))))).toEqual(
        build
      )
      expect(parseBuild(code.match(/.{1,60}/g)!.join("\n "))).toEqual(build)
    })
})
test.each([zlibSync, gzipSync, deflateSync])(
  "supports compression framing %s and empty builds",
  (compress) => {
    expect(parseBuild(encode(compress(strToU8(empty))))).toMatchObject({
      level: 1,
      className: "Warrior",
      ascendancy: "",
      stats: [],
      treeSpecs: [],
    })
  }
)
test("keeps missing, zero and infinite stats distinct", () => {
  expect(displayStat(undefined)).toBe("—")
  expect(displayStat("0")).toBe("0")
  expect(displayStat("inf")).toBe("∞")
})
test("rejects malformed, PoE1, entity declarations and excessive expansion", () => {
  for (const input of ["", "%%%", "12345", "hello"])
    expect(() => parseBuild(input)).toThrow()
  expect(() =>
    parseBuildXml(empty.replaceAll("PathOfBuilding2", "PathOfBuilding"))
  ).toThrow("Only Path of Exile 2")
  expect(() =>
    parseBuildXml('<!DOCTYPE foo [<!ENTITY x "abc">]>' + empty)
  ).toThrow("declarations")
  expect(() =>
    parseBuildXml("<PathOfBuilding2><Build></PathOfBuilding2>")
  ).toThrow("invalid XML")
  expect(() =>
    parseBuild(encode(zlibSync(strToU8("A".repeat(MAX_XML_BYTES + 1)))))
  ).toThrow("2 MB")
})
test("keeps ordered sets, string node IDs and XML text safely", () => {
  const build = parseBuildXml(
    '<PathOfBuilding2><Build level="1" className="Warrior"/><Tree activeSpec="2"><Spec nodes="1,3c" treeVersion="0_1"/><Spec nodes="2" treeVersion="0_5"/></Tree><Notes>&lt;script&gt;hi&lt;/script&gt;</Notes><Config activeConfigSet="2"><ConfigSet id="1"/><ConfigSet id="2"><Input name="boss" boolean="false"/></ConfigSet></Config></PathOfBuilding2>'
  )
  expect(build.treeSpecs.map((s) => s.version)).toEqual(["0_1", "0_5"])
  expect(build.treeSpecs[0].nodes).toEqual(["1", "3c"])
  expect(build.activeSpec).toBe(1)
  expect(build.notes).toBe("<script>hi</script>")
  expect(build.configSets[1].inputs[0].value).toBe("false")
})
test("pobb.in resolution restricts origin, credentials, ports and path", () => {
  expect(pobbinRawUrl("https://pobb.in/u/user/abc/raw")).toBe(
    "https://pobb.in/u/user/abc/raw"
  )
  expect(pobbinRawUrl("pobb.in/abc")).toBe("https://pobb.in/abc/raw")
  for (const url of [
    "https://evil.test/abc",
    "http://pobb.in/abc",
    "https://pobb.in.evil.test/abc",
    "https://user@pobb.in/abc",
    "https://pobb.in:80/abc",
    "https://pobb.in/abc/def",
    "https://pobb.in/",
  ])
    expect(() => pobbinRawUrl(url)).toThrow()
})

test("weapon set passives are read as disjoint subsets of the allocation", () => {
  const build = parseBuild(
    readFileSync(
      new URL("./fixtures/pob/R09ZhxGeretC.txt", import.meta.url),
      "utf8"
    )
  )
  const spec = build.treeSpecs[build.activeSpec]
  expect(spec.weaponSet1).toHaveLength(21)
  expect(spec.weaponSet2).toHaveLength(24)
  const nodes = new Set(spec.nodes)
  expect(spec.weaponSet1!.every((id) => nodes.has(id))).toBe(true)
  expect(spec.weaponSet2!.every((id) => nodes.has(id))).toBe(true)
  expect(spec.weaponSet1!.some((id) => spec.weaponSet2!.includes(id))).toBe(
    false
  )
  // Exports without weapon set elements still parse, with empty lists.
  const bare = parseBuildXml(
    '<PathOfBuilding2><Build level="1" className="Warrior"/><Tree><Spec nodes="1,2" treeVersion="0_5"/></Tree></PathOfBuilding2>'
  )
  expect(bare.treeSpecs[0].weaponSet1).toEqual([])
  expect(bare.treeSpecs[0].weaponSet2).toEqual([])
})
