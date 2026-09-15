import { describe, it, expect, vi, beforeEach } from "vitest";

import { getLotFeesForUserHandler, getLotFees } from "./fees";
import * as auth from "../lib/auth";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(
    (authUser: { userId?: string; _id: string }) =>
      authUser.userId ?? authUser._id
  ),
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
    const ctx = setupMockCtx({ _id: lotId, winnerId, sellerId, currentPrice: 0 }, [
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
    ]);

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
