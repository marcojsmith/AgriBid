// app/convex/crons.ts
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Periodically check for auctions that have passed their end time
 * and transition them to the appropriate settled status ('sold' or 'unsold').
 */
crons.interval(
  "settle expired auctions",
  { minutes: 1 },
  internal.auctions.settleExpiredAuctions
);

/**
 * Daily job to delete abandoned drafts older than 30 days.
 */
crons.daily(
  "cleanup abandoned drafts",
  { hourUTC: 0, minuteUTC: 0 },
  internal.auctions.cleanupDrafts
);

crons.interval(
  "cleanup presence records",
  { minutes: 15 },
  internal.presence.cleanup
);

/**
 * Daily job to process error reports and create GitHub issues.
 * Runs at 2 AM UTC to avoid peak hours.
 */
crons.daily(
  "process error reports",
  { hourUTC: 2, minuteUTC: 0 },
  internal.errors.processErrorReportsAction
);

/**
 * Weekly job to reset the showcase mock data so the demo deployment never
 * goes stale. Clears all mock application data (preserving admin profiles and
 * static reference data) and reseeds it via internal.seed.weeklyReset.
 */
crons.interval(
  "weekly mock data reset",
  { hours: 24 * 7 },
  internal.seed.weeklyReset
);

export default crons;
