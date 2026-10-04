import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { processErrorReports } from "./admin";
import * as auth from "./lib/auth";
import type { ActionCtx } from "./_generated/server";

vi.mock("./_generated/server", () => ({
  query: vi.fn((q: unknown) => q),
  mutation: vi.fn((m: unknown) => m),
  action: vi.fn((a: unknown) => a),
  internalAction: vi.fn((a: unknown) => a),
  internalMutation: vi.fn((m: unknown) => m),
  internalQuery: vi.fn((q: unknown) => q),
}));

vi.mock("./lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

// The barrel re-exports whole modules, so each one is stubbed here to keep the
// import graph (and its server-only dependencies) out of this unit test.
vi.mock("./admin/queries", () => ({
  getRecentBids: "getRecentBids",
  getTickets: "getTickets",
  getAuditLogs: "getAuditLogs",
  listAnnouncements: "listAnnouncements",
  getPendingKYC: "getPendingKYC",
  getFinancialStats: "getFinancialStats",
  getAdminStats: "getAdminStats",
  getAnnouncementStats: "getAnnouncementStats",
  getSupportStats: "getSupportStats",
  getSystemConfig: "getSystemConfig",
  getSeoSettings: "getSeoSettings",
  getBusinessInfo: "getBusinessInfo",
  getAllFaqItems: "getAllFaqItems",
  getPlatformFees: "getPlatformFees",
  getFeeStats: "getFeeStats",
  getLotFees: "getLotFees",
  getLotFeesForUser: "getLotFeesForUser",
}));

vi.mock("./admin/mutations", () => ({
  voidBid: "voidBid",
  resolveTicket: "resolveTicket",
  createAnnouncement: "createAnnouncement",
  syncLotWinners: "syncLotWinners",
  reviewKYC: "reviewKYC",
  initializeCounters: "initializeCounters",
  updateSystemConfig: "updateSystemConfig",
  updateGitHubErrorReportingConfig: "updateGitHubErrorReportingConfig",
  updatePerformanceConfig: "updatePerformanceConfig",
  updateSeoSettings: "updateSeoSettings",
  updateBusinessInfo: "updateBusinessInfo",
  createFaqItem: "createFaqItem",
  updateFaqItem: "updateFaqItem",
  deleteFaqItem: "deleteFaqItem",
  reorderFaqItems: "reorderFaqItems",
  createPlatformFee: "createPlatformFee",
  updatePlatformFee: "updatePlatformFee",
  deletePlatformFee: "deletePlatformFee",
  reorderPlatformFees: "reorderPlatformFees",
}));

vi.mock("./admin/categories", () => ({
  getCategories: "getCategories",
  addCategory: "addCategory",
  updateCategory: "updateCategory",
  deleteCategory: "deleteCategory",
}));

vi.mock("./admin/equipmentMetadata", () => ({
  getAllEquipmentMetadata: "getAllEquipmentMetadata",
  addEquipmentMake: "addEquipmentMake",
  updateEquipmentMake: "updateEquipmentMake",
  deleteEquipmentMake: "deleteEquipmentMake",
}));

vi.mock("./errors", () => ({
  submitErrorReport: "submitErrorReport",
  getErrorReports: "getErrorReports",
  getErrorReportStats: "getErrorReportStats",
  generateFingerprint: "generateFingerprint",
}));

/**
 * Invokes the inline Convex action handler registered on `processErrorReports`.
 *
 * @param ctx - Action context double
 * @returns The handler result
 */
const callProcessErrorReports = async (ctx: ActionCtx) =>
  await (
    processErrorReports as unknown as {
      handler: (
        ctx: unknown,
        args: unknown
      ) => Promise<{
        processed: number;
        created: number;
        commented: number;
        failed: number;
      }>;
    }
  ).handler(ctx, {});

describe("admin barrel", () => {
  /**
   * Builds an action context whose `runAction` resolves to the supplied result.
   *
   * @param result - Value `runAction` should resolve with
   * @returns The context double plus its `runAction` spy
   */
  const createActionCtx = (result: Record<string, number>) => {
    const runAction: Mock = vi.fn().mockResolvedValue(result);
    return { ctx: { runAction } as unknown as ActionCtx, runAction };
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("re-exports the query, mutation, error and category surface", async () => {
    const admin = await import("./admin");

    expect(admin.getAdminStats).toBe("getAdminStats");
    expect(admin.getLotFeesForUser).toBe("getLotFeesForUser");
    expect(admin.reorderPlatformFees).toBe("reorderPlatformFees");
    expect(admin.generateFingerprint).toBe("generateFingerprint");
    expect(admin.categories.getCategories).toBe("getCategories");
    expect(admin.equipmentMetadata.getAllEquipmentMetadata).toBe(
      "getAllEquipmentMetadata"
    );
  });

  describe("processErrorReports", () => {
    it("requires admin, runs the internal action and returns its result", async () => {
      const stats = { processed: 4, created: 2, commented: 1, failed: 1 };
      const { ctx, runAction } = createActionCtx(stats);

      const result = await callProcessErrorReports(ctx);

      expect(auth.requireAdmin).toHaveBeenCalledWith(ctx);
      expect(runAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({})
      );
      expect(result).toEqual(stats);
    });

    it("propagates an authorization failure without running the action", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized")
      );
      const { ctx, runAction } = createActionCtx({
        processed: 0,
        created: 0,
        commented: 0,
        failed: 0,
      });

      await expect(callProcessErrorReports(ctx)).rejects.toThrow(
        "Not authorized"
      );
      expect(runAction).not.toHaveBeenCalled();
    });

    it("propagates internal action failures", async () => {
      const runAction: Mock = vi
        .fn()
        .mockRejectedValue(new Error("GitHub unavailable"));
      const ctx = { runAction } as unknown as ActionCtx;

      await expect(callProcessErrorReports(ctx)).rejects.toThrow(
        "GitHub unavailable"
      );
    });
  });
});
