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

/**
 * Platform settings defaults (see convex/admin/platformSettings.ts). Each is the
 * fallback used when no admin has stored a value.
 */
// Buyer's premium as a PERCENT (0-100). Lots snapshot it as a fraction (0.12).
export const DEFAULT_BUYER_PREMIUM_PCT = 12;
export const DEFAULT_DEPOSIT_ENABLED = true;
// Registration deposit in rand (integer 0-1,000,000).
export const DEFAULT_DEPOSIT_AMOUNT = 5000;
export const MAX_DEPOSIT_AMOUNT = 1_000_000;
// Days to refund a deposit (integer 1-30).
export const DEFAULT_DEPOSIT_REFUND_DAYS = 3;
export const MAX_DEPOSIT_REFUND_DAYS = 30;
// Seller commission percent (display only, not wired into settlement).
export const DEFAULT_SELLER_COMMISSION_PCT = 8;
// Seller listing fee in rand.
export const DEFAULT_SELLER_LISTING_FEE = 0;
// Days until a seller is paid out (integer 1-60).
export const DEFAULT_SELLER_PAYOUT_DAYS = 7;
export const MAX_SELLER_PAYOUT_DAYS = 60;
export const DEFAULT_PUSH_REMINDERS_ENABLED = false;
// Maximum number of additional images allowed for a lot (declared here so the
// min-photos maximum below can derive from it).
export const MAX_ADDITIONAL_IMAGES = 6;
// Minimum photos required per lot (integer 1-MAX_MIN_PHOTOS_PER_LOT).
export const DEFAULT_MIN_PHOTOS_PER_LOT = 8;
// Four angle slots (front/engine/cabin/rear) plus the additional images.
export const MAX_MIN_PHOTOS_PER_LOT = 4 + MAX_ADDITIONAL_IMAGES;
export const MAX_FINANCE_CONTACT_FIELD_LENGTH = 100;

/**
 * Lot engagement (convex/engagement.ts).
 */
// A viewer counts once per lot within this window.
export const LOT_VIEW_DEDUPE_MS = 30 * MS_PER_MINUTE;
// Max counted views per viewer per hour.
export const LOT_VIEW_RATE_LIMIT_PER_HOUR = 60;
export const LOT_VIEW_RATE_LIMIT_WINDOW_MS = MS_PER_HOUR;
// lotViewers rows older than this are purged.
export const LOT_VIEWER_RETENTION_MS = MS_PER_DAY;
// Rows deleted per purge run.
export const LOT_VIEWER_PURGE_BATCH = 500;
// Counted anonymous (signed-out) views per lot per hour.
export const LOT_ANON_VIEW_CAP_PER_HOUR = 20;
// Watchlist / lotViewers rows deleted per call when removing a lot's data.
export const LOT_DATA_DELETE_BATCH = 500;
// Lots considered per auction when scoring most-engaged lots.
export const ENGAGEMENT_CANDIDATE_CAP = 100;
// Live auctions rescored per `refreshEngagementScores` run (soonest-ending first).
export const ENGAGEMENT_REFRESH_AUCTION_CAP = 5;
/** Engagement score rows scanned per refresh run when sweeping stale ones. */
export const ENGAGEMENT_SWEEP_SCAN = 500;
// Score weights: score = bids * 3 + watchers * 2 + log2(1 + views).
export const ENGAGEMENT_BID_WEIGHT = 3;
export const ENGAGEMENT_WATCHER_WEIGHT = 2;
export const ENGAGEMENT_MAX_LIMIT = 3;
export const ENGAGEMENT_DEFAULT_LIMIT = 1;

// Largest accepted cold start video file (bytes).
export const COLD_START_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

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

// How long the seller has to accept the top bid of a lot that closed with bids
// but below its reserve ("Under consideration"): 48 hours.
export const CONSIDERATION_WINDOW_MS = 48 * 60 * 60 * 1000;

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

// Home lot grid and filter chips (`getHomeLots`, `getHomeFacets`).
// Sales read per call; more ids in the args are rejected.
export const HOME_LOTS_MAX_AUCTIONS = 4;

// `assigned` lots read per sale (the facet counts and the grid are computed
// over these; a larger sale is flagged `capped`). Both queries re-run when a
// read lot changes, so this stays small: at most MAX_AUCTIONS x (cap + 1) docs.
export const HOME_LOTS_READ_PER_AUCTION = 100;

// Largest grid served (each returned lot costs an image resolve and two
// counter reads).
export const HOME_LOTS_MAX_LIMIT = 24;

// Grid size when the caller gives none.
export const HOME_LOTS_DEFAULT_LIMIT = 6;

// Auction event page (`getEventLots`, `getEventFacets`).
// Lots read per public status (assigned, sold, unsold) of one sale; a larger
// sale is flagged `capped`. At most 3 x (cap + 1) docs per call.
export const EVENT_LOTS_READ_PER_STATUS = 100;

// Largest page served ("Show 24 more" grows the limit; each returned lot costs
// an image resolve and two counter reads). Equal to the three read caps together
// so "Show more" can reach every lot that was read.
export const EVENT_LOTS_MAX_LIMIT = 3 * EVENT_LOTS_READ_PER_STATUS;

// Page size when the caller gives none.
export const EVENT_LOTS_DEFAULT_LIMIT = 24;

// Longest search text accepted by `getEventLots`.
export const EVENT_LOTS_MAX_SEARCH_LENGTH = 60;
