import { expect, test } from "vitest"
import { isEconomyStale } from "./freshness"

test("waits until 30 minutes after the next scheduled refresh", () => {
  const hour = Date.parse("2026-09-10T20:00:00Z") / 1000
  for (const time of [
    "21:05:00",
    "22:00:01",
    "22:05:00",
    "22:34:59",
    "22:35:00",
  ])
    expect(isEconomyStale(hour, Date.parse(`2026-09-10T${time}Z`))).toBe(false)
  expect(isEconomyStale(hour, Date.parse("2026-09-10T22:35:01Z"))).toBe(true)
})

test("a new snapshot clears the warning, including across UTC midnight", () => {
  const now = Date.parse("2026-09-11T00:36:00Z")
  expect(isEconomyStale(Date.parse("2026-09-10T22:00:00Z") / 1000, now)).toBe(
    true
  )
  expect(isEconomyStale(Date.parse("2026-09-10T23:00:00Z") / 1000, now)).toBe(
    false
  )
})

test("does not warn before the client clock is initialized", () => {
  expect(isEconomyStale(Date.parse("2026-09-10T20:00:00Z") / 1000, 0)).toBe(
    false
  )
})
