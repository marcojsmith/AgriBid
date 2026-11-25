// app/convex/crons.ts
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

// Every job targets a gated wrapper in convex/cronJobs.ts that returns early
// when an admin has switched the job off (Settings -> Performance).
const crons = cronJobs();

/**
 * Periodically check for auctions that have passed their end time
 * and transition them to the appropriate settled status ('sold' or 'unsold').
 */
crons.interval(
  "settle expired auctions",
  { minutes: 1 },
  internal.cronJobs.settleExpiredAuctions
);

/**
 * Expire lots whose seller did not decide on the top bid within 48 hours
 * ("Under consideration" -> "Not sold"). Bounded and idempotent.
 */
crons.interval(
  "expire consideration lots",
  { minutes: 5 },
  internal.cronJobs.expireConsiderationLots
);

/**
 * Daily job to delete abandoned drafts older than 30 days.
 */
crons.daily(
  "cleanup abandoned drafts",
  { hourUTC: 0, minuteUTC: 0 },
  internal.cronJobs.cleanupAbandonedDrafts
);

crons.interval(
  "cleanup presence records",
  { minutes: 15 },
  internal.cronJobs.cleanupPresenceRecords
);

/**
 * Daily job to sweep orphaned file-storage uploads (files no longer
 * referenced by any lot image, condition report, KYC document or auction
 * banner). Uses `crons.interval` per the Convex guidelines, which disallow
 * the `crons.daily` helper.
 */
crons.interval(
  "sweep orphaned uploads",
  { hours: 24 },
  internal.cronJobs.sweepOrphanedUploads
);

/**
 * Daily job to purge lot-viewer dedupe records older than 24 hours.
 */
crons.interval(
  "purge lot viewers",
  { hours: 24 },
  internal.cronJobs.purgeLotViewers
);

/**
 * Rebuild the precomputed lot engagement scores of live auctions every 5
 * minutes (reads counters only; powers `getMostEngagedLots`).
 */
crons.interval(
  "refresh engagement scores",
  { minutes: 5 },
  internal.cronJobs.refreshEngagementScores
);

/**
 * Send the "sale is open" push to everyone who tapped Remind me. The Admin
 * "Push reminders" setting is the real switch; this job is a cheap no-op while
 * it is off.
 */
crons.interval(
  "send sale reminders",
  { minutes: 1 },
  internal.cronJobs.sendSaleReminders,
  {}
);

/**
 * Send the "closing in 1 hour" push to everyone who watches a lot. The Admin
 * "Watched-lot alerts" setting is the real switch; this job is a cheap no-op
 * while it is off.
 */
crons.interval(
  "send closing soon alerts",
  { minutes: 5 },
  internal.cronJobs.sendClosingSoonAlerts,
  {}
);

/**
 * Remind buyers a day before a won-lot payment is due. Once per payment
 * (`reminderSentAt`), bounded per run.
 */
crons.interval(
  "send payment reminders",
  { minutes: 15 },
  internal.cronJobs.sendPaymentReminders,
  {}
);

/**
 * Daily job to process error reports and create GitHub issues.
 * Runs at 2 AM UTC to avoid peak hours.
 */
crons.daily(
  "process error reports",
  { hourUTC: 2, minuteUTC: 0 },
  internal.cronJobs.processErrorReports
);

/**
 * Weekly job to reset the showcase mock data so the demo deployment never
 * goes stale. Clears all mock application data (preserving admin profiles and
 * static reference data) and reseeds it via internal.cronJobs.weeklyMockDataReset.
 */
crons.interval(
  "weekly mock data reset",
  { hours: 24 * 7 },
  internal.cronJobs.weeklyMockDataReset
);

export default crons;
