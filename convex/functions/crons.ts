import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
// The action checks COLLECTOR_ENABLED. Collection stays paused until usage is reviewed.
crons.cron("exchange hour", "5 * * * *", internal.ingestion.ingest, {})
crons.cron("exchange retention", "35 * * * *", internal.store.cleanup, {})

// The action uses a persisted due time; most ticks make no X request.
crons.interval("X updates", { minutes: 15 }, internal.xIngestion.poll, {})

crons.interval("Patch notes", { hours: 1 }, internal.patchIngestion.poll, {})

export default crons
