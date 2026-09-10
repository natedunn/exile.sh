import {
  ANCHORS,
  DAY,
  HOUR,
  QUOTES,
  change,
  eligibleMover,
  quotePoints,
} from "./economy"
import type { ItemRow, Point } from "./economy"

export const MOVER_PERIODS = ["24h", "48h", "7d", "30d", "90d"] as const
export type MoverPeriod = (typeof MOVER_PERIODS)[number]
export const MOVER_PERIOD: Record<
  MoverPeriod,
  { label: string; seconds: number }
> = {
  "24h": { label: "24 hours", seconds: DAY },
  "48h": { label: "48 hours", seconds: 2 * DAY },
  "7d": { label: "7 days", seconds: 7 * DAY },
  "30d": { label: "1 month (30 days)", seconds: 30 * DAY },
  "90d": { label: "3 months (90 days)", seconds: 90 * DAY },
}
export function moverMetrics(
  rows: ItemRow[],
  byItem: Map<string, Point[]>,
  at: number,
  offset: number
) {
  return rows.map((row) => {
    const points = byItem.get(row.id) ?? []
    const changes = QUOTES.map((quote) =>
      change(
        quotePoints(points, byItem.get(ANCHORS[quote]) ?? [], quote),
        at,
        offset
      )
    )
    return {
      id: row.id,
      changes,
      eligible: changes.map(
        (value, i) =>
          value !== null &&
          row.id !== ANCHORS[QUOTES[i]] &&
          eligibleMover(points, at, offset)
      ),
    }
  })
}
export const HISTORY_RETENTION = 92 * DAY
export const ARCHIVE_RETENTION = 8 * DAY
export const COMPARISON_WINDOW = 3 * HOUR
