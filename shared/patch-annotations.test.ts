import { expect, test } from "vitest"
import { locateAnnotation } from "./patch-annotations"

const text = "Spark now fires more projectiles. Spark damage is reduced."

test("saved offsets win while they still cover the quote", () => {
  expect(
    locateAnnotation(text, { start: 34, end: 39, quote: "Spark" })
  ).toEqual({ start: 34, end: 39 })
})

test("an edited post re-finds the quote nearest the old offset", () => {
  const edited = `Hotfix. ${text}`
  expect(
    locateAnnotation(edited, { start: 34, end: 39, quote: "Spark" })
  ).toEqual({ start: 42, end: 47 })
  expect(
    locateAnnotation(edited, { start: 0, end: 5, quote: "Spark" })
  ).toEqual({ start: 8, end: 13 })
})

test("a quote that left the post is not placed", () => {
  expect(locateAnnotation(text, { start: 0, end: 5, quote: "Arc" })).toBeNull()
})
