/**
 * Auction status constants representing the lifecycle of an auction listing.
 */
export const AUCTION_STATUS = {
  /** Initial state when a seller creates a listing but hasn't submitted it yet */
  DRAFT: "draft",
  /** Listing has been submitted by seller and is awaiting admin approval */
  PENDING_REVIEW: "pending_review",
  /** Listing is live and accepting bids */
  ACTIVE: "active",
  /** Bidding period has ended and the reserve price was met */
  SOLD: "sold",
  /** Bidding period has ended but the reserve price was not met */
  UNSOLD: "unsold",
  /** Listing was rejected by an admin during the review process */
  REJECTED: "rejected",
} as const;

/**
 * Type representing valid auction statuses.
 */
export type AuctionStatus =
  (typeof AUCTION_STATUS)[keyof typeof AUCTION_STATUS];

/**
 * User role constants defining different access levels.
 */
export const USER_ROLE = {
  /** Standard user who can browse and place bids */
  BUYER: "buyer",
  /** User who can create equipment listings */
  SELLER: "seller",
  /** Platform administrator with moderation and management privileges */
  ADMIN: "admin",
} as const;

/**
 * Type representing valid user roles.
 */
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/**
 * KYC (Know Your Customer) status constants for identity verification.
 */
export const KYC_STATUS = {
  /** Verification is in progress */
  PENDING: "pending",
  /** Identity has been successfully verified */
  VERIFIED: "verified",
  /** Identity verification was rejected */
  REJECTED: "rejected",
} as const;

/**
 * Type representing valid KYC statuses.
 */
export type KYCStatus = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];

/**
 * Default label for uncategorized equipment.
 */
export const UNCATEGORIZED_LABEL = "Uncategorized";
