/**
 * Barrel file for admin operations.
 *
 * This file re-exports all admin-related functions from the modular structure
 * to maintain backward compatibility with existing imports. All implementations
 * have been decomposed into focused modules:
 *
 * - queries.ts: Core read-only operations (bid monitoring, support, audit, announcements)
 * - mutations.ts: Core write operations (bid moderation, support, announcements, sync)
 * - kyc.ts: KYC verification and review
 * - statistics.ts: Dashboard metrics and financial reporting
 * - categories.ts: Equipment category management
 * - equipmentMetadata.ts: Machinery make and model catalog
 */

// Re-export specialized modules for hierarchical access
export * as categories from "./admin/categories";
export * as equipmentMetadata from "./admin/equipmentMetadata";

// Re-export query functions
export {
  getRecentBids,
  getTickets,
  getAuditLogs,
  listAnnouncements,
  getPendingKYC,
  getFinancialStats,
  getAdminStats,
  getAnnouncementStats,
  getSupportStats,
  getSystemConfig,
} from "./admin/queries";

// Re-export mutation functions
export {
  voidBid,
  resolveTicket,
  createAnnouncement,
  syncAuctionWinners,
  reviewKYC,
  initializeCounters,
  updateSystemConfig,
} from "./admin/mutations";
