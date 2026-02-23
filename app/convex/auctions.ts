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
  getEquipmentMetadata,
  getSellerInfo,
  getSellerListings,
  getAllAuctions,
  getMyBids,
  getMyListings,
} from "./auctions/queries";

// Re-export all standard mutations
export {
  generateUploadUrl,
  deleteUpload,
  createAuction,
  approveAuction,
  rejectAuction,
  adminUpdateAuction,
  bulkUpdateAuctions,
} from "./auctions/mutations";

// Re-export bidding mutations
export { placeBid } from "./auctions/bidding";

// Re-export internal mutations
export { settleExpiredAuctions } from "./auctions/internal";

// Re-export helpers and validators
export {
  resolveImageUrls,
  AuctionSummaryValidator,
  toAuctionSummary,
  AuctionDetailValidator,
} from "./auctions/helpers";
export type { RawImages } from "./auctions/helpers";