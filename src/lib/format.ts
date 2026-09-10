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
