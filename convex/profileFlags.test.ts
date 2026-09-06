import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  reportProfileHandler,
  reviewProfileFlagHandler,
  getAllPendingProfileFlagsHandler,
} from "./profileFlags";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import { MS_PER_DAY } from "./constants";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("./admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("reportProfile mutation", () => {
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    profilesResult: unknown = null,
    existingReports: unknown[] = []
  ) => {
    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(profilesResult),
    };
    const profileFlagsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(existingReports),
    };
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn((table: string) =>
        table === "profiles" ? profilesQuery : profileFlagsQuery
      ),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  it("should allow a user to report another user's profile", async () => {
    const reportedUserId = "user_reported";
    const reporterId = "user_reporter";

    mockCtx = setupMockCtx({ userId: reportedUserId, name: "Reported User" });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await reportProfileHandler(mockCtx, {
      reportedUserId,
      reason: "fake_account",
      details: "Looks like a scam",
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "profileFlags",
      expect.objectContaining({
        reportedUserId,
        reporterId,
        reason: "fake_account",
        details: "Looks like a scam",
        status: "pending",
      })
    );
  });

  it("should fail if the user reports their own profile", async () => {
    const userId = "user_reporter";

    mockCtx = setupMockCtx();
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    await expect(
      reportProfileHandler(mockCtx, {
        reportedUserId: userId,
        reason: "other",
      })
    ).rejects.toThrow("You cannot report your own profile");
  });

  it("should fail if the reported profile does not exist", async () => {
    mockCtx = setupMockCtx(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_reporter");

    await expect(
      reportProfileHandler(mockCtx, {
        reportedUserId: "nonexistent",
        reason: "other",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should fail if the user already has a pending report against the same profile", async () => {
    const reportedUserId = "user_reported";
    const reporterId = "user_reporter";

    const existingReports = [
      {
        reportedUserId,
        reporterId,
        status: "pending",
        createdAt: Date.now() - 1 * MS_PER_DAY,
      },
    ];

    mockCtx = setupMockCtx({ userId: reportedUserId }, existingReports);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    await expect(
      reportProfileHandler(mockCtx, {
        reportedUserId,
        reason: "other",
      })
    ).rejects.toThrow("You have already reported this profile");
  });

  it("should allow a new report when the previous pending report is older than 30 days", async () => {
    const reportedUserId = "user_reported";
    const reporterId = "user_reporter";

    const existingReports = [
      {
        reportedUserId,
        reporterId,
        status: "pending",
        createdAt: Date.now() - 31 * MS_PER_DAY,
      },
    ];

    mockCtx = setupMockCtx({ userId: reportedUserId }, existingReports);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await reportProfileHandler(mockCtx, {
      reportedUserId,
      reason: "other",
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalled();
  });
});

describe("reviewProfileFlag mutation", () => {
  let mockCtx: MutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (flagDoc: unknown = null) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(flagDoc),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(),
    };
    return {
      db: mockDb as unknown as MutationCtx["db"],
    } as unknown as MutationCtx;
  };

  it("should allow an admin to mark a report as reviewed", async () => {
    const flagId = "flag123" as Id<"profileFlags">;
    const flagDoc = {
      _id: flagId,
      reportedUserId: "user_reported",
      reason: "fake_account",
      status: "pending",
    };

    mockCtx = setupMockCtx(flagDoc);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      userId: "admin123",
      _id: "admin123",
    });
    vi.mocked(auth.resolveUserId).mockReturnValue("admin123");

    const result = await reviewProfileFlagHandler(mockCtx, {
      flagId,
      status: "reviewed",
      adminNotes: "Confirmed fake account",
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(flagId, {
      status: "reviewed",
      adminNotes: "Confirmed fake account",
    });
    expect(adminUtils.logAudit).toHaveBeenCalledWith(
      mockCtx,
      expect.objectContaining({
        action: "REVIEW_PROFILE_FLAG",
        targetId: flagId,
        targetType: "profileFlag",
      })
    );
  });

  it("should allow an admin to dismiss a report", async () => {
    const flagId = "flag123" as Id<"profileFlags">;
    const flagDoc = {
      _id: flagId,
      reportedUserId: "user_reported",
      reason: "other",
      status: "pending",
    };

    mockCtx = setupMockCtx(flagDoc);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      userId: "admin123",
      _id: "admin123",
    });
    vi.mocked(auth.resolveUserId).mockReturnValue("admin123");

    const result = await reviewProfileFlagHandler(mockCtx, {
      flagId,
      status: "dismissed",
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(flagId, {
      status: "dismissed",
      adminNotes: undefined,
    });
  });

  it("should fail if not an admin", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.getCallerRole).mockResolvedValue("user");

    await expect(
      reviewProfileFlagHandler(mockCtx, {
        flagId: "f1" as Id<"profileFlags">,
        status: "reviewed",
      })
    ).rejects.toThrow("Not authorized: Admin privileges required");
  });

  it("should throw error if flag not found", async () => {
    const flagId = "flag123" as Id<"profileFlags">;
    mockCtx = setupMockCtx(null);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      reviewProfileFlagHandler(mockCtx, { flagId, status: "dismissed" })
    ).rejects.toThrow(ConvexError);
  });

  it("should fail if the flag has already been reviewed", async () => {
    const flagId = "flag123" as Id<"profileFlags">;
    const flagDoc = {
      _id: flagId,
      status: "reviewed",
    };

    mockCtx = setupMockCtx(flagDoc);
    vi.mocked(auth.getCallerRole).mockResolvedValue("admin");

    await expect(
      reviewProfileFlagHandler(mockCtx, { flagId, status: "dismissed" })
    ).rejects.toThrow("Flag has already been reviewed");
  });
});

describe("getAllPendingProfileFlags query", () => {
  let mockCtx: QueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    flags: unknown[] = [],
    profilesResults: unknown[] = []
  ) => {
    let profileLookupCount = 0;
    const profilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn(() =>
        Promise.resolve(profilesResults[profileLookupCount++] ?? null)
      ),
    };
    const profileFlagsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(flags),
    };
    const mockDb = {
      query: vi.fn((table: string) =>
        table === "profileFlags" ? profileFlagsQuery : profilesQuery
      ),
    };
    return {
      db: mockDb as unknown as QueryCtx["db"],
    } as unknown as QueryCtx;
  };

  it("should return pending flags with reporter and reported user names", async () => {
    const flags = [
      {
        _id: "flag1",
        reportedUserId: "user_reported",
        reporterId: "user_reporter",
        reason: "fake_account",
        status: "pending",
        createdAt: Date.now(),
      },
    ];

    // First profile lookup is the reporter, second is the reported user.
    mockCtx = setupMockCtx(flags, [
      { userId: "user_reporter", name: "Alice" },
      null,
    ]);
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin123",
      userId: "admin123",
    });

    const result = await getAllPendingProfileFlagsHandler(mockCtx);

    expect(result).toHaveLength(1);
    expect(result[0].reporterName).toBe("Alice");
    expect(result[0].reportedUserName).toBe("Unknown User");
  });

  it("should fail if not an admin", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.requireAdmin).mockRejectedValue(
      new Error("Not authorized: Admin privileges required")
    );

    await expect(getAllPendingProfileFlagsHandler(mockCtx)).rejects.toThrow(
      "Not authorized: Admin privileges required"
    );
  });
});
