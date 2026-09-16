import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAllAuctionsHandler,
  getAuctionByIdHandler,
  getPublishedAuctionsHandler,
  getPublishedAuctionHandler,
  getAssignmentCandidatesHandler,
} from "./events";
import * as auth from "../../lib/auth";
import * as imageCache from "../../image_cache";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

vi.mock("../../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../image_cache", () => ({
  resolveUrlCached: vi.fn(),
}));

describe("Auction event queries", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    storage: unknown;
  };

  const auctionRow = {
    _id: "a1" as Id<"auctions">,
    _creationTime: 1000,
    title: "Spring Sale",
    description: "Annual spring equipment sale",
    bannerImage: "storage1" as Id<"_storage">,
    startTime: 2000,
    endTime: 3000,
    status: "published" as const,
    defaultBuyerPremiumPct: 0.05,
    defaultSellerCommissionPct: 0.03,
    createdBy: "admin1",
    createdAt: 1000,
    updatedAt: 1000,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        query: vi.fn(),
      },
      storage: {},
    };
  });

  describe("getAllAuctionsHandler", () => {
    it("requires admin and returns auctions with resolved banners and lot counts", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });
      vi.mocked(imageCache.resolveUrlCached).mockResolvedValue(
        "https://cdn/banner1.jpg"
      );

      const auctionsQuery = {
        order: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auctionRow]),
      };
      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([{ _id: "l1" }, { _id: "l2" }]),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "auctions") return auctionsQuery;
        return lotsQuery;
      });

      const result = await getAllAuctionsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(auth.requireAdmin).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: "a1",
        title: "Spring Sale",
        bannerImageUrl: "https://cdn/banner1.jpg",
        lotCount: 2,
      });
    });
  });

  // eslint-disable-next-line no-secrets/no-secrets -- handler function name, not a secret
  describe("getAuctionByIdHandler", () => {
    it("returns null when the auction doesn't exist", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });
      mockCtx.db.get.mockResolvedValue(null);

      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "missing" as Id<"auctions"> }
      );

      expect(result).toBeNull();
    });

    it("returns the auction with resolved banner and lot count when found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });
      vi.mocked(imageCache.resolveUrlCached).mockResolvedValue(undefined);
      mockCtx.db.get.mockResolvedValue(auctionRow);
      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      };
      mockCtx.db.query.mockReturnValue(lotsQuery);

      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toMatchObject({ _id: "a1", lotCount: 0 });
    });
  });

  // eslint-disable-next-line no-secrets/no-secrets -- handler function name, not a secret
  describe("getPublishedAuctionsHandler", () => {
    it("does not require admin and merges published + closed auctions sorted by startTime desc", async () => {
      vi.mocked(imageCache.resolveUrlCached).mockResolvedValue(undefined);

      const published = {
        ...auctionRow,
        _id: "a1" as Id<"auctions">,
        startTime: 1000,
      };
      const closed = {
        ...auctionRow,
        _id: "a2" as Id<"auctions">,
        status: "closed" as const,
        startTime: 5000,
      };

      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      };
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "auctions") {
          return {
            withIndex: vi.fn((_idx: string, cb: (q: unknown) => unknown) => {
              const captured = { status: "" };
              cb({
                eq: (_field: string, value: string) => {
                  captured.status = value;
                  return captured;
                },
              });
              return {
                collect: vi
                  .fn()
                  .mockResolvedValue(
                    captured.status === "published" ? [published] : [closed]
                  ),
              };
            }),
          };
        }
        return lotsQuery;
      });

      const result = await getPublishedAuctionsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(auth.requireAdmin).not.toHaveBeenCalled();
      expect(result.map((r) => r._id)).toEqual(["a2", "a1"]);
    });
  });

  // eslint-disable-next-line no-secrets/no-secrets -- handler function name, not a secret
  describe("getPublishedAuctionHandler", () => {
    it("returns null for a missing auction", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      const result = await getPublishedAuctionHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "missing" as Id<"auctions"> }
      );

      expect(result).toBeNull();
    });

    it("returns null for a draft auction", async () => {
      mockCtx.db.get.mockResolvedValue({ ...auctionRow, status: "draft" });

      const result = await getPublishedAuctionHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toBeNull();
    });

    it("returns the auction with its lots without requiring admin", async () => {
      vi.mocked(imageCache.resolveUrlCached).mockResolvedValue(undefined);
      mockCtx.db.get.mockResolvedValue(auctionRow);
      const lots = [
        { _id: "l1" as Id<"lots">, status: "assigned", images: {} },
        { _id: "l2" as Id<"lots">, status: "sold", images: {} },
      ];
      const lotsQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue(lots),
      };
      mockCtx.db.query.mockReturnValue(lotsQuery);

      const result = await getPublishedAuctionHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(auth.requireAdmin).not.toHaveBeenCalled();
      expect(result?.lots.map((lot) => lot._id)).toEqual(["l1", "l2"]);
    });
  });

  describe("getAssignmentCandidatesHandler", () => {
    it("requires admin and returns unassigned-approved and currently-assigned lots", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin1" });

      const approvedLot = {
        _id: "l1" as Id<"lots">,
        status: "approved",
        images: {},
      };
      const assignedLot = {
        _id: "l2" as Id<"lots">,
        status: "assigned",
        auctionId: "a1",
        images: {},
      };

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "lots") {
          return {
            withIndex: vi.fn((_idx: string, cb: (q: unknown) => unknown) => {
              const captured: Record<string, unknown> = {};
              cb({
                eq: (field: string, value: unknown) => {
                  // eslint-disable-next-line security/detect-object-injection -- field is a query-builder arg captured in this test mock, not user input
                  captured[field] = value;
                  return captured;
                },
              });
              return {
                collect: vi
                  .fn()
                  .mockResolvedValue(
                    "status" in captured && captured.status === "approved"
                      ? [approvedLot]
                      : [assignedLot]
                  ),
              };
            }),
          };
        }
        return { get: vi.fn() };
      });
      mockCtx.db.get.mockResolvedValue(null);

      const result = await getAssignmentCandidatesHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(auth.requireAdmin).toHaveBeenCalled();
      expect(result.unassigned).toHaveLength(1);
      expect(result.unassigned[0]._id).toBe("l1");
      expect(result.assigned).toHaveLength(1);
      expect(result.assigned[0]._id).toBe("l2");
    });
  });
});
