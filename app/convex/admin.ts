/**
 * Barrel file for admin operations.
 *
 * This file re-exports all admin-related functions from the modular structure
 * to maintain backward compatibility with existing imports. All implementations
 * have been decomposed into focused modules:
 *
 * - index.ts: Core admin operations (bid mgmt, support, audit logs, announcements)
 * - kyc.ts: KYC verification and review
 * - statistics.ts: Dashboard metrics and financial reporting
 */

// Re-export all functions from admin submodules
export {
  // Core operations
  getRecentBids,
  voidBid,
  getTickets,
  resolveTicket,
  getAuditLogs,
  createAnnouncement,
  listAnnouncements,
  // KYC operations
  getPendingKYC,
  reviewKYC,
  // Statistics and reporting
  getFinancialStats,
  getAdminStats,
  getAnnouncementStats,
  getSupportStats,
  initializeCounters,
} from "./admin/index";
