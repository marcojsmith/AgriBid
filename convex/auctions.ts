/**
 * Barrel file for auction operations.
 *
 * This file re-exports all auction-related functions from the modular structure
 * to maintain backward compatibility with existing imports. All implementations
 * have been decomposed into focused modules:
 *
 * - queries.ts: Read operations (getActiveLots, getLotById, getPublishedAuctions, etc.)
 * - mutations/: Standard write operations (createLot, updateLot, etc.)
 * - bidding.ts: Bid-specific mutations (placeBid, etc.)
 * - internal.ts: Internal operations called by the system (settleExpiredLots)
 * - helpers.ts: Shared utilities and transformation functions
 */

// Re-export all query functions
export {
  getPendingLots,
  getActiveLots,
  getActiveMakes,
  getRelatedLots,
  getLotById,
  getLotBids,
  getLotBidCount,
  getEquipmentMetadata,
  getCategories,
  getSellerInfo,
  getSellerListings,
  getAllLots,
  getMyBids,
  getMyBidsCount,
  getMyListings,
  getMyListingsCount,
  getMyListingsStats,
  getLotFlags,
  getAllPendingFlags,
} from "./auctions/queries";

// Re-export auction (scheduled sale container) queries
export {
  getAllAuctions,
  getAuctionById,
  getPublishedAuctions,
  getPublishedAuction,
  getAssignmentCandidates,
} from "./auctions/queries/events";

// Re-export mutations from the new modular structure
export {
  generateUploadUrl,
  createLot,
  saveDraft,
} from "./auctions/mutations/create";

export {
  updateLot,
  adminUpdateLot,
  bulkUpdateLots,
  uploadConditionReport,
} from "./auctions/mutations/update";

export {
  deleteUpload,
  deleteDraft,
  deleteConditionReport,
} from "./auctions/mutations/delete";

export {
  flagLot,
  dismissFlag,
  closeLotEarly,
} from "./auctions/mutations/publish";

// Re-export bidding mutations
export { placeBid } from "./auctions/mutations/bidding";

// Re-export proxy bidding queries
export { getMyProxyBid } from "./auctions/proxy_bidding";

// Re-export internal mutations
export { settleExpiredLots, cleanupDrafts } from "./auctions/internal";

// Re-export helpers and validators
export {
  resolveImageUrls,
  LotSummaryValidator,
  toLotSummary,
  LotDetailValidator,
} from "./auctions/helpers";
export type { RawImages } from "./auctions/helpers";
