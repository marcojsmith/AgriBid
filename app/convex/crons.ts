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
  // @ts-expect-error - Convex type instantiation complexity, no runtime impact
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

export default crons;
