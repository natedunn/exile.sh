import { HOUR } from "./economy"

// The exchange cron runs at :05 UTC; allow 30 minutes after the next refresh.
// Source timestamps identify the START of the completed trading hour.
const REFRESH_MINUTE = 5
const GRACE_MINUTES = 30

export function isEconomyStale(sourceHour: number, nowMs: number): boolean {
  const nextRefresh = sourceHour + 2 * HOUR + REFRESH_MINUTE * 60
  return nowMs > (nextRefresh + GRACE_MINUTES * 60) * 1000
}
