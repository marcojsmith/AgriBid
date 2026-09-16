import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getLotFeesForUserHandler,
  getLotFees,
  getPlatformFees,
  createPlatformFee,
  updatePlatformFee,
  deletePlatformFee,
  reorderPlatformFees,
  getFeeStats,
} from "./fees";
import * as auth from "../lib/auth";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(
    (authUser: { userId?: string; _id: string }) =>
      authUser.userId ?? authUser._id
  ),
}));

vi.mock("../admin_utils", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../_generated/server", () => ({
  query: vi.fn((q: unknown) => q),
  mutation: vi.fn((m: unknown) => m),
  internalMutation: vi.fn((m: unknown) => m),
}));

interface MockLotFee {
  feeId: Id<"platformFees">;
  feeName: string;
  feeType: "percentage" | "fixed";
  rate: number;
  calculatedAmount: number;
  appliedTo: "buyer" | "seller";
}

describe("getLotFeesForUser (IDOR regression, #295)", () => {
  const lotId = "lot1" as Id<"lots">;
  const winnerId = "winner-user";
  const sellerId = "seller-user";
  const attackerId = "attacker-user";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const feeId1 = "fee1" as Id<"platformFees">;
  const feeId2 = "fee2" as Id<"platformFees">;

  const setupMockCtx = (
    lot: Record<string, unknown>,
    lotFees: MockLotFee[] = []
  ) => {
    const platformFees = new Map(
      lotFees.map((f) => [f.feeId, { _id: f.feeId, isActive: true }])
    );
    const mockDb = {
      get: vi.fn().mockImplementation((table: string, id: unknown) => {
        if (table === "lots") {
          return Promise.resolve(lot);
        }
        if (table === "platformFees") {
          return Promise.resolve(
            platformFees.get(id as Id<"platformFees">) ?? null
          );
        }
        return Promise.resolve(null);
      }),
      query: vi.fn().mockImplementation((table: string) => ({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue(
            table === "lotFees"
              ? lotFees
              : table === "platformFees"
                ? [...platformFees.values()]
                : []
          ),
      })),
    };
    return { db: mockDb } as unknown as QueryCtx;
  };

  it("returns empty fees when caller is unauthenticated", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue(null);
    const ctx = setupMockCtx({ _id: lotId, winnerId, sellerId });

    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result).toEqual({ buyerFees: [], sellerFees: [] });
  });

  it("returns empty fees when caller is neither winner nor seller (IDOR attempt)", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: attackerId,
      userId: attackerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx({ _id: lotId, winnerId, sellerId });

    // Attacker cannot read another user's fees by any means — the query no
    // longer accepts a client-supplied userId at all.
    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result).toEqual({ buyerFees: [], sellerFees: [] });
  });

  it("resolves and categorizes platformFees-sourced fees for the authenticated winner", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: winnerId,
      userId: winnerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx(
      { _id: lotId, winnerId, sellerId, currentPrice: 0 },
      [
        {
          feeId: feeId1,
          feeName: "Buyer Commission",
          feeType: "percentage",
          rate: 0.05,
          calculatedAmount: 500,
          appliedTo: "buyer",
        },
        {
          feeId: feeId2,
          feeName: "Seller Commission",
          feeType: "percentage",
          rate: 0.03,
          calculatedAmount: 300,
          appliedTo: "seller",
        },
      ]
    );

    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result).toEqual({
      buyerFees: [
        {
          feeName: "Buyer Commission",
          feeType: "percentage",
          rate: 0.05,
          calculatedAmount: 500,
        },
      ],
      sellerFees: [
        {
          feeName: "Seller Commission",
          feeType: "percentage",
          rate: 0.03,
          calculatedAmount: 300,
        },
      ],
    });
    expect(ctx.db.get).toHaveBeenCalledWith("lots", lotId);
  });

  it("derives fees from the lot's snapshotted auction defaults when no ledger rows exist", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: winnerId,
      userId: winnerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx({
      _id: lotId,
      winnerId,
      sellerId,
      currentPrice: 2000,
      resolvedBuyerPremiumPct: 0.05,
      resolvedSellerCommissionPct: 0.03,
    });

    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result).toEqual({
      buyerFees: [
        {
          feeName: "Auction Buyer Premium",
          feeType: "percentage",
          rate: 0.05,
          calculatedAmount: 100,
        },
      ],
      sellerFees: [
        {
          feeName: "Auction Seller Commission",
          feeType: "percentage",
          rate: 0.03,
          calculatedAmount: 60,
        },
      ],
    });
  });

  it("merges platformFees-sourced rows with auction-default fees", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: sellerId,
      userId: sellerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx(
      {
        _id: lotId,
        winnerId,
        sellerId,
        currentPrice: 1000,
        resolvedBuyerPremiumPct: 0.1,
      },
      [
        {
          feeId: feeId1,
          feeName: "Seller Commission",
          feeType: "fixed",
          rate: 100,
          calculatedAmount: 100,
          appliedTo: "seller",
        },
      ]
    );

    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result.buyerFees).toEqual([
      {
        feeName: "Auction Buyer Premium",
        feeType: "percentage",
        rate: 0.1,
        calculatedAmount: 100,
      },
    ]);
    expect(result.sellerFees).toEqual([
      {
        feeName: "Seller Commission",
        feeType: "fixed",
        rate: 100,
        calculatedAmount: 100,
      },
    ]);
  });

  it("excludes fees tied to an inactive platform fee", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: sellerId,
      userId: sellerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx(
      { _id: lotId, winnerId, sellerId, currentPrice: 0 },
      [
        {
          feeId: feeId1,
          feeName: "Stale Fee",
          feeType: "fixed",
          rate: 100,
          calculatedAmount: 100,
          appliedTo: "seller",
        },
      ]
    );
    // Mark the platform fee inactive after setup so it's filtered out.
    vi.mocked(ctx.db.query).mockImplementation(
      (table: string) =>
        ({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(
            table === "lotFees"
              ? [
                  {
                    feeId: feeId1,
                    feeName: "Stale Fee",
                    feeType: "fixed",
                    rate: 100,
                    calculatedAmount: 100,
                    appliedTo: "seller",
                  },
                ]
              : []
          ),
        }) as unknown as ReturnType<QueryCtx["db"]["query"]>
    );

    const result = await getLotFeesForUserHandler(ctx, { lotId });

    expect(result).toEqual({ buyerFees: [], sellerFees: [] });
  });

  it("throws when the lot does not exist", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: winnerId,
      userId: winnerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx({});
    vi.mocked(ctx.db.get).mockResolvedValue(null);

    await expect(getLotFeesForUserHandler(ctx, { lotId })).rejects.toThrow(
      "Lot not found"
    );
  });
});

describe("getLotFees (admin)", () => {
  const lotId = "lot1" as Id<"lots">;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns lotFee rows scoped to the lot", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    } as never);

    const rows = [
      {
        _id: "lf1" as Id<"lotFees">,
        _creationTime: 1,
        lotId,
        feeId: "fee1" as Id<"platformFees">,
        feeName: "Buyer Commission",
        appliedTo: "buyer" as const,
        feeType: "percentage" as const,
        rate: 0.05,
        salePrice: 1000,
        calculatedAmount: 50,
        createdAt: 1,
      },
    ];

    const ctx = {
      db: {
        query: vi.fn().mockImplementation((table: string) => ({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(table === "lotFees" ? rows : []),
        })),
      },
    } as unknown as QueryCtx;

    const handler = (
      getLotFees as unknown as {
        handler: (
          ctx: QueryCtx,
          args: { lotId: Id<"lots"> }
        ) => Promise<unknown>;
      }
    ).handler;

    const result = await handler(ctx, { lotId });

    expect(result).toEqual(rows);
    expect(ctx.db.query).toHaveBeenCalledWith("lotFees");
  });
});

/**
 * Extracts the handler from a mocked Convex query/mutation config object.
 * @param fn - The exported query/mutation (mocked to return its config).
 * @returns The handler function, typed with the supplied args/result.
 */
const getHandler = <Args, Result = Promise<Args>>(
  fn: unknown
): ((ctx: MutationCtx, args: Args) => Promise<Result>) =>
  (fn as { handler: (ctx: MutationCtx, args: Args) => Promise<Result> })
    .handler;

interface FeeMutationCtxOptions {
  fee?: Record<string, unknown> | null;
  duplicateFees?: Record<string, unknown>[];
  platformFees?: Record<string, unknown>[];
  lotFees?: Record<string, unknown>[];
}

/**
 * Builds a mutation context for the platform-fee CRUD handlers. The
 * `platformFees` query returns different rows depending on whether a `.filter`
 * was applied (duplicate-name check vs. sort-order scan).
 * @param opts - Configured rows for each query path.
 * @returns A mock mutation context.
 */
const makeFeeMutationCtx = (opts: FeeMutationCtxOptions = {}): MutationCtx => {
  const db = {
    get: vi.fn().mockResolvedValue(opts.fee ?? null),
    insert: vi.fn().mockResolvedValue("new-fee-id"),
    patch: vi.fn().mockResolvedValue(undefined),
    query: vi.fn((table: string) => {
      const chain = {
        withIndex: vi.fn(),
        filter: vi.fn(),
        collect: vi.fn(),
      };
      chain.withIndex.mockReturnValue(chain);
      if (table === "lotFees") {
        chain.collect.mockResolvedValue(opts.lotFees ?? []);
        return chain;
      }
      let filtered = false;
      chain.filter.mockImplementation(() => {
        filtered = true;
        return chain;
      });
      chain.collect.mockImplementation(() =>
        Promise.resolve(
          filtered ? (opts.duplicateFees ?? []) : (opts.platformFees ?? [])
        )
      );
      return chain;
    }),
  };
  return { db } as unknown as MutationCtx;
};

interface CreateFeeArgs {
  name: string;
  description?: string;
  feeType: "percentage" | "fixed";
  value: number;
  appliesTo: "buyer" | "seller" | "both";
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
}

interface UpdateFeeArgs {
  feeId: string;
  name?: string;
  description?: string;
  feeType?: "percentage" | "fixed";
  value?: number;
  sortOrder?: number;
}

describe("platform fee CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    } as never);
  });

  describe("getPlatformFees", () => {
    it("returns all fees and the active subset", async () => {
      const fees = [
        { _id: "f1", name: "A", isActive: true },
        { _id: "f2", name: "B", isActive: false },
      ];
      const ctx = makeFeeMutationCtx({ platformFees: fees });

      const result = await getHandler<
        Record<string, never>,
        {
          activeFees: Record<string, unknown>[];
          allFees: Record<string, unknown>[];
        }
      >(getPlatformFees)(ctx, {});

      expect(result.allFees).toEqual(fees);
      expect(result.activeFees).toEqual([fees[0]]);
    });
  });

  describe("createPlatformFee", () => {
    const baseArgs: CreateFeeArgs = {
      name: "Buyer Premium",
      feeType: "percentage",
      value: 0.05,
      appliesTo: "buyer",
      isActive: true,
      visibleToBuyer: true,
      visibleToSeller: false,
    };

    it("creates a fee after the current max sortOrder", async () => {
      const ctx = makeFeeMutationCtx({ platformFees: [{ sortOrder: 4 }] });

      const result = await getHandler<
        CreateFeeArgs,
        { success: boolean; feeId: string }
      >(createPlatformFee)(ctx, baseArgs);

      expect(result).toEqual({ success: true, feeId: "new-fee-id" });
      expect(ctx.db.insert).toHaveBeenCalledWith(
        "platformFees",
        expect.objectContaining({ name: "Buyer Premium", sortOrder: 5 })
      );
    });

    it("rejects an empty name", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          name: "   ",
        })
      ).rejects.toThrow("Fee name must be between 1 and 100 characters");
    });

    it("rejects a name longer than 100 characters", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          name: "x".repeat(101),
        })
      ).rejects.toThrow("Fee name must be between 1 and 100 characters");
    });

    it("rejects a percentage below the minimum", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          value: 0,
        })
      ).rejects.toThrow("Percentage fee must be between");
    });

    it("rejects a percentage above the maximum", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          value: 1.5,
        })
      ).rejects.toThrow("Percentage fee must be between");
    });

    it("rejects a fixed fee of zero", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          feeType: "fixed",
          value: 0,
        })
      ).rejects.toThrow("Fixed fee must be greater than 0");
    });

    it("rejects a fixed fee above the cap", async () => {
      const ctx = makeFeeMutationCtx();
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, {
          ...baseArgs,
          feeType: "fixed",
          value: 1_000_001,
        })
      ).rejects.toThrow("Fixed fee cannot exceed 1000000");
    });

    it("rejects a duplicate active name", async () => {
      const ctx = makeFeeMutationCtx({
        duplicateFees: [
          { _id: "existing", name: "Buyer Premium", isActive: true },
        ],
      });
      await expect(
        getHandler<CreateFeeArgs, unknown>(createPlatformFee)(ctx, baseArgs)
      ).rejects.toThrow('A fee with name "Buyer Premium" already exists');
    });
  });

  describe("updatePlatformFee", () => {
    it("throws when the fee is missing", async () => {
      const ctx = makeFeeMutationCtx({ fee: null });
      await expect(
        getHandler<UpdateFeeArgs, unknown>(updatePlatformFee)(ctx, {
          feeId: "f1",
          name: "New",
        })
      ).rejects.toThrow("Fee not found");
    });

    it("trims and patches a provided name", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0.05 },
      });

      const result = await getHandler<UpdateFeeArgs, { success: boolean }>(
        updatePlatformFee
      )(ctx, { feeId: "f1", name: "  Renamed  " });

      expect(result.success).toBe(true);
      expect(ctx.db.patch).toHaveBeenCalledWith(
        "platformFees",
        "f1",
        expect.objectContaining({ name: "Renamed" })
      );
    });

    it("rejects an invalid name update", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0.05 },
      });
      await expect(
        getHandler<UpdateFeeArgs, unknown>(updatePlatformFee)(ctx, {
          feeId: "f1",
          name: "",
        })
      ).rejects.toThrow("Fee name must be between 1 and 100 characters");
    });

    it("validates a new value against the existing feeType", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0.05 },
      });
      await expect(
        getHandler<UpdateFeeArgs, unknown>(updatePlatformFee)(ctx, {
          feeId: "f1",
          value: 2,
        })
      ).rejects.toThrow("Percentage fee must be between");
    });

    it("validates the existing value against a new feeType", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0 },
      });
      await expect(
        getHandler<UpdateFeeArgs, unknown>(updatePlatformFee)(ctx, {
          feeId: "f1",
          feeType: "fixed",
        })
      ).rejects.toThrow("Fixed fee must be greater than 0");
    });

    it("validates value and feeType together", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0.05 },
      });

      const result = await getHandler<UpdateFeeArgs, { success: boolean }>(
        updatePlatformFee
      )(ctx, {
        feeId: "f1",
        feeType: "fixed",
        value: 250,
      });

      expect(result.success).toBe(true);
    });

    it("patches a trimmed description", async () => {
      const ctx = makeFeeMutationCtx({
        fee: { _id: "f1", name: "Old", feeType: "percentage", value: 0.05 },
      });
      await getHandler<UpdateFeeArgs, unknown>(updatePlatformFee)(ctx, {
        feeId: "f1",
        description: "  hi  ",
      });
      expect(ctx.db.patch).toHaveBeenCalledWith(
        "platformFees",
        "f1",
        expect.objectContaining({ description: "hi" })
      );
    });
  });

  describe("deletePlatformFee", () => {
    it("throws when the fee is missing", async () => {
      const ctx = makeFeeMutationCtx({ fee: null });
      await expect(
        getHandler<{ feeId: string }, unknown>(deletePlatformFee)(ctx, {
          feeId: "f1",
        })
      ).rejects.toThrow("Fee not found");
    });

    it("soft-deletes a fee", async () => {
      const ctx = makeFeeMutationCtx({ fee: { _id: "f1", name: "Old" } });

      const result = await getHandler<{ feeId: string }, { success: boolean }>(
        deletePlatformFee
      )(ctx, { feeId: "f1" });

      expect(result.success).toBe(true);
      expect(ctx.db.patch).toHaveBeenCalledWith(
        "platformFees",
        "f1",
        expect.objectContaining({ isActive: false })
      );
    });
  });

  describe("reorderPlatformFees", () => {
    it("throws when any fee is missing", async () => {
      const ctx = makeFeeMutationCtx({ fee: null });
      await expect(
        getHandler<{ feeIds: string[] }, unknown>(reorderPlatformFees)(ctx, {
          feeIds: ["f1"],
        })
      ).rejects.toThrow("Fee not found: f1");
    });

    it("patches each fee with its new sortOrder", async () => {
      const ctx = makeFeeMutationCtx({ fee: { _id: "f1", name: "A" } });

      const result = await getHandler<
        { feeIds: string[] },
        { success: boolean }
      >(reorderPlatformFees)(ctx, { feeIds: ["f1", "f2"] });

      expect(result.success).toBe(true);
      expect(ctx.db.patch).toHaveBeenCalledWith(
        "platformFees",
        "f1",
        expect.objectContaining({ sortOrder: 0 })
      );
      expect(ctx.db.patch).toHaveBeenCalledWith(
        "platformFees",
        "f2",
        expect.objectContaining({ sortOrder: 1 })
      );
    });
  });

  describe("getFeeStats", () => {
    it("aggregates totals and groups duplicate fee names", async () => {
      const ctx = makeFeeMutationCtx({
        lotFees: [
          {
            feeName: "Buyer Premium",
            appliedTo: "buyer",
            calculatedAmount: 50,
          },
          {
            feeName: "Buyer Premium",
            appliedTo: "buyer",
            calculatedAmount: 25,
          },
          {
            feeName: "Seller Commission",
            appliedTo: "seller",
            calculatedAmount: 30,
          },
        ],
      });

      const result = await getHandler<
        Record<string, never>,
        {
          totalFeesCollected: number;
          buyerFeesTotal: number;
          sellerFeesTotal: number;
          feeBreakdown: {
            feeName: string;
            totalAmount: number;
            count: number;
          }[];
        }
      >(getFeeStats)(ctx, {});

      expect(result.totalFeesCollected).toBe(105);
      expect(result.buyerFeesTotal).toBe(75);
      expect(result.sellerFeesTotal).toBe(30);
      expect(result.feeBreakdown).toContainEqual({
        feeName: "Buyer Premium",
        totalAmount: 75,
        count: 2,
      });
    });
  });
});
