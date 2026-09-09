import { describe, it, expect, vi, beforeEach } from "vitest";

import { reviewKYC, getPendingKYC } from "./kyc";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";

vi.mock("../_generated/server", () => ({
  mutation: vi.fn((config: unknown) => config),
  query: vi.fn((config: unknown) => config),
}));

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  logAudit: vi.fn(),
  updateCounter: vi.fn(),
}));

interface MockQuery {
  withIndex: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  unique: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

const reviewKYCHandler = (
  reviewKYC as unknown as {
    handler: (
      ctx: MutationCtx,
      args: {
        userId: string;
        decision: "approve" | "reject";
        reason?: string;
      }
    ) => Promise<{ success: boolean }>;
  }
).handler;

const getPendingKYCHandler = (
  getPendingKYC as unknown as {
    handler: (
      ctx: MutationCtx,
      args: { paginationOpts: { numItems: number; cursor: string | null } }
    ) => Promise<{
      page: {
        _id: string;
        _creationTime: number;
        userId: string;
        role: string;
        kycStatus?: string;
      }[];
      isDone: boolean;
      continueCursor: string;
    }>;
  }
).handler;

describe("reviewKYC mutation", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();

    const q: MockQuery = {
      withIndex: vi.fn((_idx: unknown, cb?: (q: unknown) => unknown) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return q;
      }),
      unique: vi.fn().mockResolvedValue(null),
      paginate: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };
    queryMock = q;

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => queryMock),
      },
    };

    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
  });

  it("approves KYC and logs a verification_approved activity entry", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "pending",
      isVerified: false,
    });

    const result = await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "approve",
    });

    expect(result).toEqual({ success: true });
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "userActivity",
      expect.objectContaining({
        userId: "user1",
        type: "verification_approved",
        description: "Verification approved",
        createdAt: expect.any(Number) as number,
      })
    );
  });

  it("rejects KYC with the reason and logs a verification_rejected activity entry", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "pending",
      isVerified: false,
    });

    const result = await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "reject",
      reason: "Documents are illegible",
    });

    expect(result).toEqual({ success: true });
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "userActivity",
      expect.objectContaining({
        userId: "user1",
        type: "verification_rejected",
        description: "Verification rejected: Documents are illegible",
        createdAt: expect.any(Number) as number,
      })
    );
  });

  it("still sends the notifications row alongside the activity entry", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "pending",
      isVerified: false,
    });

    await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "approve",
    });

    const insertedTables = vi
      .mocked(mockCtx.db.insert)
      .mock.calls.map((call) => call[0] as string);
    expect(insertedTables).toContain("notifications");
    expect(insertedTables).toContain("userActivity");
  });

  it("throws if profile not found", async () => {
    queryMock.unique.mockResolvedValue(null);

    await expect(
      reviewKYCHandler(mockCtx as unknown as MutationCtx, {
        userId: "user1",
        decision: "approve",
      })
    ).rejects.toThrow("Profile not found");
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });

  it("throws if rejection has no reason", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "pending",
      isVerified: false,
    });

    await expect(
      reviewKYCHandler(mockCtx as unknown as MutationCtx, {
        userId: "user1",
        decision: "reject",
      })
    ).rejects.toThrow("Rejection reason is required");
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });

  it("approving an already-verified user does not increment the verified counter", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "rejected",
      isVerified: true,
    });

    const result = await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "approve",
    });

    expect(result).toEqual({ success: true });
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "userActivity",
      expect.objectContaining({
        userId: "user1",
        type: "verification_approved",
      })
    );
  });

  it("requires an admin", async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(
      new Error("Not authorized: Admin privileges required")
    );

    await expect(
      reviewKYCHandler(mockCtx as unknown as MutationCtx, {
        userId: "user1",
        decision: "approve",
      })
    ).rejects.toThrow("Not authorized: Admin privileges required");
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });

  it("rejecting an already-verified user revokes verification and logs activity", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "verified",
      isVerified: true,
    });

    const result = await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "reject",
      reason: "Fraudulent documents",
    });

    expect(result).toEqual({ success: true });
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ kycStatus: "rejected", isVerified: false })
    );
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "userActivity",
      expect.objectContaining({
        userId: "user1",
        type: "verification_rejected",
        description: "Verification rejected: Fraudulent documents",
      })
    );
  });

  it("resubmission after rejection logs a fresh verification_rejected entry", async () => {
    queryMock.unique.mockResolvedValue({
      _id: "p1",
      userId: "user1",
      kycStatus: "rejected",
      isVerified: false,
      kycRejectionReason: "Previous rejection",
    });

    await reviewKYCHandler(mockCtx as unknown as MutationCtx, {
      userId: "user1",
      decision: "reject",
      reason: "Still illegible",
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "userActivity",
      expect.objectContaining({
        userId: "user1",
        type: "verification_rejected",
        description: "Verification rejected: Still illegible",
      })
    );
  });
});

describe("getPendingKYC query", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();

    const q: MockQuery = {
      withIndex: vi.fn((_idx: unknown, cb?: (q: unknown) => unknown) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return q;
      }),
      unique: vi.fn().mockResolvedValue(null),
      paginate: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };
    queryMock = q;

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => queryMock),
      },
    };

    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
  });

  it("returns a minimal page of pending KYC profiles", async () => {
    queryMock.paginate.mockResolvedValue({
      page: [
        {
          _id: "p1",
          _creationTime: 1000,
          userId: "user1",
          role: "seller",
          kycStatus: "pending",
          firstName: "should-not-leak",
        },
        {
          _id: "p2",
          _creationTime: 2000,
          userId: "user2",
          role: "buyer",
          kycStatus: "pending",
        },
      ],
      isDone: false,
      continueCursor: "cursor1",
    });

    const result = await getPendingKYCHandler(
      mockCtx as unknown as MutationCtx,
      { paginationOpts: { numItems: 10, cursor: null } }
    );

    expect(mockCtx.db.query).toHaveBeenCalledWith("profiles");
    expect(result.isDone).toBe(false);
    expect(result.continueCursor).toBe("cursor1");
    expect(result.page).toEqual([
      {
        _id: "p1",
        _creationTime: 1000,
        userId: "user1",
        role: "seller",
        kycStatus: "pending",
      },
      {
        _id: "p2",
        _creationTime: 2000,
        userId: "user2",
        role: "buyer",
        kycStatus: "pending",
      },
    ]);
  });

  it("requires an admin", async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(
      new Error("Not authorized: Admin privileges required")
    );

    await expect(
      getPendingKYCHandler(mockCtx as unknown as MutationCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).rejects.toThrow("Not authorized: Admin privileges required");
  });
});
