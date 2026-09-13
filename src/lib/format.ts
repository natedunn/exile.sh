export function number(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 0.01 && value !== 0 ? 5 : digits,
  }).format(value)
}
export function compact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}
export function percent(value: number | null) {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${number(value, 1)}%`
}
export function utc(hour: number) {
  return (
    new Date(hour * 1000).toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  )
}
// Elapsed time in the coarsest unit that is not zero, e.g. "25 minutes ago".
const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" })
export function ago(fromMs: number, nowMs: number) {
  const minutes = Math.max(0, Math.round((nowMs - fromMs) / 60_000))
  if (minutes < 60) return relative.format(-minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, "hour")
  return relative.format(-Math.round(hours / 24), "day")
}
// Calendar dates for posts, e.g. "Sep 12, 2026".
const dayFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})
export function day(ms: number) {
  return dayFormat.format(ms)
}
