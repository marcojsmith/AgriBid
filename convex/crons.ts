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
 * Periodically notify users whose watchlisted auctions are ending soon.
 * Runs every 15 minutes to check auctions within each user's configured alert window.
 */
crons.interval(
  "notify watchlist ending soon",
  { minutes: 15 },
  internal.watchlistNotifications.notifyWatchlistEndingSoon
);

/**
 * Daily job to remove notificationLog entries older than 7 days.
 */
crons.interval(
  "cleanup notification logs",
  { hours: 24 },
  internal.watchlistNotifications.cleanupOldNotificationLogs
);

export default crons;
