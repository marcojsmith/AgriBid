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

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

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
  getSeoSettings,
  getAllFaqItems,
  getPlatformFees,
  getFeeStats,
  getAuctionFees,
  getAuctionFeesForUser,
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
  updateGitHubErrorReportingConfig,
  updateSeoSettings,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  reorderFaqItems,
  createPlatformFee,
  updatePlatformFee,
  deletePlatformFee,
  reorderPlatformFees,
} from "./admin/mutations";

// Re-export error reporting functions
export {
  submitErrorReport,
  getErrorReports,
  getErrorReportStats,
  generateFingerprint,
} from "./errors";

/**
 * Action to process error reports.
 * Re-exported as a public action for admin use.
 */
export const processErrorReports = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    processed: number;
    created: number;
    commented: number;
    failed: number;
  }> => {
    await requireAdmin(ctx as unknown as MutationCtx);
    return await ctx.runAction(internal.errors.processErrorReportsAction, {});
  },
});
