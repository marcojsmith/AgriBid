/**
 * Barrel file for auction operations.
 *
 * This file re-exports all auction-related functions from the modular structure
 * to maintain backward compatibility with existing imports. All implementations
 * have been decomposed into focused modules:
 *
 * - queries.ts: Read operations (listAuctions, getAuctionById, etc.)
 * - mutations/: Standard write operations (createAuction, updateAuction, etc.)
 * - bidding.ts: Bid-specific mutations (placeBid, etc.)
 * - internal.ts: Internal operations called by the system (settleExpiredAuctions)
 * - helpers.ts: Shared utilities and transformation functions
 */

// Re-export all query functions
export {
  getPendingAuctions,
  getActiveAuctions,
  getActiveMakes,
  getRelatedAuctions,
  getAuctionById,
  getAuctionBids,
  getAuctionBidCount,
  getEquipmentMetadata,
  getCategories,
  getSellerInfo,
  getSellerListings,
  getAllAuctions,
  getMyBids,
  getMyBidsCount,
  getMyListings,
  getMyListingsCount,
  getMyListingsStats,
  getAuctionFlags,
  getAllPendingFlags,
} from "./auctions/queries";

// Re-export mutations from the new modular structure
export {
  generateUploadUrl,
  createAuction,
  saveDraft,
} from "./auctions/mutations/create";

export {
  updateAuction,
  adminUpdateAuction,
  bulkUpdateAuctions,
  uploadConditionReport,
} from "./auctions/mutations/update";

export {
  deleteUpload,
  deleteDraft,
  deleteConditionReport,
} from "./auctions/mutations/delete";

export {
  submitForReview,
  publishAuction,
  approveAuction,
  rejectAuction,
  flagAuction,
  dismissFlag,
  closeAuctionEarly,
} from "./auctions/mutations/publish";

// Re-export bidding mutations
export { placeBid } from "./auctions/mutations/bidding";

// Re-export proxy bidding queries
export { getMyProxyBid } from "./auctions/proxy_bidding";

// Re-export internal mutations
export { settleExpiredAuctions, cleanupDrafts } from "./auctions/internal";

// Re-export helpers and validators
export {
  resolveImageUrls,
  AuctionSummaryValidator,
  toAuctionSummary,
  AuctionDetailValidator,
} from "./auctions/helpers";
export type { RawImages } from "./auctions/helpers";
