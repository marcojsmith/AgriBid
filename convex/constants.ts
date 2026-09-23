/**
 * Pagination and results limit constants.
 */

// Default number of items to fetch per pagination page.
export const PAGINATION_DEFAULT_LIMIT = 20;

// Hard cap for results in computation queries (e.g. makes, active auctions count).
// This prevents silent truncation while allowing reasonable data volume for analytics.
export const MAX_RESULTS_CAP = 1000;

// Default limit for specific lists like equipment metadata.
export const EQUIPMENT_METADATA_LIMIT = 50;

// Default limit for bidding history.
export const BID_HISTORY_LIMIT = 50;

/**
 * Time constants in milliseconds.
 */
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Performance / demo-mode defaults.
 *
 * Runtime-adjustable by admins via the settings table (see
 * convex/admin/settings.ts); these are the fallbacks used when a setting row
 * is absent.
 */
// Whether demo mode is enabled when no admin has configured it.
export const DEMO_MODE_ENABLED_DEFAULT = false;

// Default presence heartbeat interval in ms. Must stay in sync with the
// client-side fallback in src/components/PresenceListener.tsx.
export const PRESENCE_HEARTBEAT_INTERVAL_MS_DEFAULT = 60 * MS_PER_SECOND;

// Allowed bounds for the presence heartbeat interval setting (15s - 5min).
// NOTE: countOnlineUsers marks users offline after a fixed 90s threshold
// (convex/presence.ts PRESENCE_HEARTBEAT_THRESHOLD), so intervals above ~90s
// will make signed-in users appear offline between heartbeats. Accepted for
// demo-mode resource savings; deriving the threshold from the configured
// interval is a possible follow-up.
export const PRESENCE_HEARTBEAT_INTERVAL_MS_MIN = 15 * MS_PER_SECOND;
export const PRESENCE_HEARTBEAT_INTERVAL_MS_MAX = 5 * MS_PER_MINUTE;

/**
 * Auction lifecycle and validation constants.
 */
export const AUCTION_MIN_DURATION_DAYS = 1;
export const AUCTION_MAX_DURATION_DAYS = 365;
export const AUCTION_DEFAULT_DURATION_DAYS = 7;

// Maximum number of additional images allowed for an auction.
export const MAX_ADDITIONAL_IMAGES = 6;

// Threshold for switching between small and large bid increments.
export const PRICE_THRESHOLD_FOR_INCREMENT = 10000;
export const SMALL_INCREMENT_AMOUNT = 100;
export const LARGE_INCREMENT_AMOUNT = 500;

// Number of flags required to automatically hide an auction for review.
export const AUCTION_FLAG_AUTO_HIDE_THRESHOLD = 3;

// Maximum number of auctions that can be updated in a single bulk operation.
export const MAX_BULK_UPDATE_SIZE = 50;

/**
 * startTime validation bounds for auction scheduling.
 * Sellers have stricter limits than admins.
 */
export const STARTTIME_MAX_PAST_MS = MS_PER_MINUTE;
export const STARTTIME_MAX_FUTURE_MS = 365 * MS_PER_DAY;
export const STARTTIME_ADMIN_MAX_PAST_MS = 365 * MS_PER_DAY;
export const STARTTIME_ADMIN_MAX_FUTURE_MS = 10 * 365 * MS_PER_DAY;

// Duration before auction end that triggers a soft close (extension).
export const SOFT_CLOSE_THRESHOLD_MS = 2 * MS_PER_MINUTE;

/**
 * Retention and cleanup constants.
 */
// Number of days to keep abandoned drafts before cleanup.
export const DRAFT_RETENTION_DAYS = 30;
export const DRAFT_RETENTION_MS = DRAFT_RETENTION_DAYS * MS_PER_DAY;

// Batch size for background cleanup tasks.
export const CLEANUP_BATCH_SIZE = 100;

// Safety cap for admin-only moderation/management views that would otherwise
// `.collect()` an entire status bucket unbounded.
export const ADMIN_COLLECTION_CAP = 500;

// Safety cap per status bucket ("published"/"closed") when building the
// public auction-event feed, before merging and sorting.
export const PUBLISHED_AUCTIONS_STATUS_CAP = 50;

// Maximum number of storage files examined (and deleted) per orphaned-upload
// sweep run.
export const STORAGE_SWEEP_BATCH_SIZE = 500;

// Age a storage file must reach before the orphaned-upload sweep may delete
// it, so uploads whose referencing document is written moments later are
// never treated as orphans.
export const STORAGE_SWEEP_MIN_AGE_MS = MS_PER_DAY;

// Moving creation-time window examined by the daily storage sweep. The
// seven-day overlap is longer than the cron interval, giving transiently
// skipped candidates several opportunities to be examined without letting
// ancient referenced files occupy every batch forever.
export const STORAGE_SWEEP_LOOKBACK_MS = 7 * MS_PER_DAY;

/**
 * Support ticket constants.
 */
export const SUPPORT_TICKET_MAX_SUBJECT_LENGTH = 100;
export const SUPPORT_TICKET_MAX_MESSAGE_LENGTH = 2000;
