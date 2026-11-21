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

// VAT rate (percent) applied in fee estimates when no admin has set one.
// South African standard rate. Keep in sync with `src/lib/vat.ts`.
export const DEFAULT_VAT_RATE_PCT = 15;

// Default presence heartbeat interval in ms. Must stay in sync with the
// client-side fallback in src/components/PresenceListener.tsx.
export const PRESENCE_HEARTBEAT_INTERVAL_MS_DEFAULT = 60 * MS_PER_SECOND;

// Allowed bounds for the presence heartbeat interval setting (15s - 5min).
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

// Batch size for settlement cron to process expired lots per run.
export const SETTLEMENT_BATCH_SIZE = 50;

// Safety cap for admin-only moderation/management views that would otherwise
// `.collect()` an entire status bucket unbounded.
export const ADMIN_COLLECTION_CAP = 500;

// Safety cap per status bucket ("published"/"closed") when building the
// public auction-event feed, before merging and sorting.
export const PUBLISHED_AUCTIONS_STATUS_CAP = 50;

// Maximum lots read per public status (assigned/sold/unsold) when summarising
// one auction event for the public event cards. Beyond this the summary's
// lot count is a lower bound and `lotCountCapped` is true.
export const AUCTION_SUMMARY_LOT_CAP = 20;

// Largest page the public event feed serves, bounding per-call lot reads
// (page size x 3 statuses x AUCTION_SUMMARY_LOT_CAP+1).
export const PUBLISHED_AUCTIONS_MAX_PAGE_SIZE = 12;

// Number of lead photos returned per auction event summary.
export const AUCTION_SUMMARY_IMAGE_COUNT = 3;

// Closing-soon lot strip (`getClosingSoonLots`).
// Lots closing within this long from now are listed.
export const CLOSING_SOON_WINDOW_MS = MS_PER_DAY;

// Soft-close extensions have no maximum (each late bid pushes a lot's end out by
// SOFT_CLOSE_THRESHOLD_MS), so a sale that already passed its `endTime` can still
// have running lots. Only sales that ended within this look-back are checked for
// such lots; a lot running on past it is no longer listed.
export const CLOSING_SOON_EXTENSION_LOOKBACK_MS = MS_PER_DAY;

// Sales still to end inside the window (read soonest first).
export const CLOSING_SOON_UPCOMING_AUCTION_CAP = 20;

// Recently ended sales read as soft-close candidates (most recently ended first).
export const CLOSING_SOON_ENDED_AUCTION_CAP = 10;

// Visible lots kept per sale; the strip returns at most CLOSING_SOON_LOT_LIMIT.
export const CLOSING_SOON_LOTS_PER_AUCTION = 13;

// Lots read per sale, so hidden lots do not crowd out visible ones.
export const CLOSING_SOON_LOTS_READ_PER_AUCTION = 20;

// Largest distance (ms) between a client `asOf` and the server clock before it
// is treated as bogus (and ignored).
export const CLOSING_SOON_AS_OF_MAX_SKEW_MS = MS_PER_HOUR;

// Most lots the strip returns.
export const CLOSING_SOON_LOT_LIMIT = 12;

// Bids read per returned lot to learn whether it has a (non-voided) bid.
export const CLOSING_SOON_BID_PROBE = 10;

// Convex caches query results and does not re-run them as time passes, so the
// client passes the current time rounded down to this bucket as `asOf`; a new
// bucket is a new cache entry, which re-evaluates the 24 h window.
export const CLOSING_SOON_REFRESH_BUCKET_MS = 5 * MS_PER_MINUTE;

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

// Batch size for scanning reference tables during the orphaned-upload sweep.
// This bounds the number of documents read from each table per sweep run.
export const STORAGE_SWEEP_REFERENCE_BATCH_SIZE = 500;

// Safety valve on the reference scan: the maximum number of pages read from
// any one table. Exceeding it aborts the sweep with nothing deleted (a scan
// that cannot finish must never lead to deletions).
export const STORAGE_SWEEP_MAX_REFERENCE_PAGES = 400;

/**
 * Support ticket constants.
 */
export const SUPPORT_TICKET_MAX_SUBJECT_LENGTH = 100;
export const SUPPORT_TICKET_MAX_MESSAGE_LENGTH = 2000;

/**
 * Input length caps for free-text fields.
 */
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_REVIEW_COMMENT_LENGTH = 2000;
export const MAX_AUCTION_TITLE_LENGTH = 150;
export const MAX_AUCTION_DESCRIPTION_LENGTH = 5000;
export const MAX_FLAG_DETAILS_LENGTH = 1000;
export const MAX_PROFILE_BIO_LENGTH = 1000;
export const MAX_PROFILE_FIELD_LENGTH = 200;
export const MAX_ERROR_REPORT_FIELD_LENGTH = 5000;

/**
 * Upper bound on bid amounts (R10 billion).
 * Prevents overflow in fee calculations and counters.
 */
export const MAX_BID_AMOUNT = 10_000_000_000;

/**
 * Rate limiting constants for lot/draft creation.
 */
export const LOT_CREATION_COOLDOWN_MS = 5_000;
export const MAX_DRAFTS_PER_USER = 20;

/**
 * Rate limiting constants for review submission.
 */
export const REVIEW_RATE_LIMIT_WINDOW_MS = MS_PER_MINUTE;
export const MAX_REVIEWS_PER_WINDOW = 10;

/**
 * Rate limiting constants for support ticket submission.
 */
export const SUPPORT_RATE_LIMIT_WINDOW_MS = MS_PER_HOUR;
export const MAX_SUPPORT_TICKETS_PER_WINDOW = 5;

/**
 * Rate limiting constants for profile reports.
 */
export const PROFILE_REPORT_RATE_LIMIT_WINDOW_MS = MS_PER_DAY;
export const MAX_PROFILE_REPORTS_PER_WINDOW = 10;

/**
 * Rate limiting constants for KYC submission.
 */
export const KYC_RATE_LIMIT_WINDOW_MS = MS_PER_DAY;
export const MAX_KYC_SUBMISSIONS_PER_WINDOW = 3;
