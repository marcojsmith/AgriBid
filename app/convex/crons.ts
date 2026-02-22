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
  internal.auctions.settleExpiredAuctions,
);

// Process pending error reports every 5 minutes (rate-limited batch size)
crons.interval(
  "process pending error reports",
  { minutes: 5 },
  internal.errors.processPendingErrorReports,
);

export default crons;
