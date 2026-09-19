import { expect, test } from "vitest"
import { cn } from "../src/lib/cn"

test("keeps custom type sizes alongside custom text colours", () => {
  expect(cn("display text-title text-ink")).toContain("text-title")
  expect(cn("mono-label text-label text-brand")).toContain("text-label")
})
