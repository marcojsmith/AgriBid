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
