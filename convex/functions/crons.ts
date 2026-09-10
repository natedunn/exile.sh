import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
// The action checks COLLECTOR_ENABLED. Collection stays paused until usage is reviewed.
crons.cron("exchange hour", "5 * * * *", internal.ingestion.ingest, {})
crons.cron("retain eight days", "35 * * * *", internal.store.cleanup, {})

export default crons
