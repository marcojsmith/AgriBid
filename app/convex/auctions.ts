/**
 * Barrel file for auction operations.
 *
 * This file re-exports all auction-related functions from the modular structure
 * to maintain backward compatibility with existing imports. All implementations
 * have been decomposed into focused modules:
 *
 * - queries.ts: Read operations (listAuctions, getAuctionById, etc.)
 * - mutations.ts: Standard write operations (createAuction, updateAuction, etc.)
 * - bidding.ts: Bid-specific mutations (placeBid, etc.)
 * - internal.ts: Internal operations called by the system (settleExpiredAuctions)
 * - helpers.ts: Shared utilities and transformation functions
 */

// Re-export all query functions
export {
  getPendingAuctions,
  getActiveAuctions,
  getActiveMakes,
  getAuctionById,
  getAuctionBids,
  getAuctionBidCount,
  getEquipmentMetadata,
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

// Re-export all standard mutations
export {
  generateUploadUrl,
  deleteUpload,
  createAuction,
  saveDraft,
  updateAuction,
  submitForReview,
  deleteDraft,
  uploadConditionReport,
  deleteConditionReport,
  flagAuction,
  dismissFlag,
  approveAuction,
  rejectAuction,
  adminUpdateAuction,
  bulkUpdateAuctions,
  closeAuctionEarly,
  publishAuction,
} from "./auctions/mutations";

// Re-export bidding mutations
export { placeBid } from "./auctions/bidding";

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
