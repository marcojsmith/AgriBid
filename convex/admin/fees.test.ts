import { describe, it, expect, vi, beforeEach } from "vitest";

import { getAuctionFeesForUserHandler } from "./fees";
import * as auth from "../lib/auth";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(
    (authUser: { userId?: string; _id: string }) =>
      authUser.userId ?? authUser._id
  ),
}));

describe("getAuctionFeesForUser (IDOR regression, #295)", () => {
  const auctionId = "auction1" as Id<"auctions">;
  const winnerId = "winner-user";
  const sellerId = "seller-user";
  const attackerId = "attacker-user";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const feeId1 = "fee1" as Id<"platformFees">;
  const feeId2 = "fee2" as Id<"platformFees">;

  const setupMockCtx = (
    auctionFees: {
      feeId: Id<"platformFees">;
      feeName: string;
      feeType: "percentage" | "fixed";
      rate: number;
      calculatedAmount: number;
      appliedTo: "buyer" | "seller";
    }[] = []
  ) => {
    const platformFees = new Map(
      auctionFees.map((f) => [f.feeId, { _id: f.feeId, isActive: true }])
    );
    const mockDb = {
      get: vi.fn().mockImplementation((table: string, id: unknown) => {
        if (table === "auctions") {
          return Promise.resolve({ _id: auctionId, winnerId, sellerId });
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
            table === "auctionFees"
              ? auctionFees
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
    const ctx = setupMockCtx();

    const result = await getAuctionFeesForUserHandler(ctx, { auctionId });

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
    const ctx = setupMockCtx();

    // Attacker cannot read another user's fees by any means — the query no
    // longer accepts a client-supplied userId at all.
    const result = await getAuctionFeesForUserHandler(ctx, { auctionId });

    expect(result).toEqual({ buyerFees: [], sellerFees: [] });
  });

  it("resolves and categorizes fees for the authenticated winner", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: winnerId,
      userId: winnerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx([
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

    const result = await getAuctionFeesForUserHandler(ctx, { auctionId });

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
    expect(ctx.db.get).toHaveBeenCalledWith("auctions", auctionId);
  });

  it("excludes fees tied to an inactive platform fee", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: sellerId,
      userId: sellerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx([
      {
        feeId: feeId1,
        feeName: "Stale Fee",
        feeType: "fixed",
        rate: 100,
        calculatedAmount: 100,
        appliedTo: "seller",
      },
    ]);
    // Mark the platform fee inactive after setup so it's filtered out.
    vi.mocked(ctx.db.query).mockImplementation(
      (table: string) =>
        ({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(
            table === "auctionFees"
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

    const result = await getAuctionFeesForUserHandler(ctx, { auctionId });

    expect(result).toEqual({ buyerFees: [], sellerFees: [] });
  });

  it("throws when the auction does not exist", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      _id: winnerId,
      userId: winnerId,
      email: null,
      name: null,
      image: null,
    });
    const ctx = setupMockCtx();
    vi.mocked(ctx.db.get).mockResolvedValue(null);

    await expect(
      getAuctionFeesForUserHandler(ctx, { auctionId })
    ).rejects.toThrow("Auction not found");
  });
});
