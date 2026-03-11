import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTicketHandler, getMyTicketsHandler } from "./support";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("./admin_utils", () => ({
  updateCounter: vi.fn(),
}));

type MockCtxType = {
  db: {
    insert: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
};

describe("Support Coverage", () => {
  let mockCtx: MockCtxType;

  const mockUser: NonNullable<Awaited<ReturnType<typeof auth.getAuthUser>>> = {
    _id: "u1",
    userId: "u1",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        insert: vi.fn().mockResolvedValue("ticket1" as Id<"supportTickets">),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([]),
        })),
      },
    };
  });

  describe("createTicketHandler", () => {
    it("should throw if user ID cannot be determined", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue(undefined as any);

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "Help",
          message: "I need help",
          priority: "medium",
        })
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should validate subject length", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "",
          message: "I need help",
          priority: "medium",
        })
      ).rejects.toThrow("Subject must be between 1 and 100 characters");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "a".repeat(101),
          message: "I need help",
          priority: "medium",
        })
      ).rejects.toThrow("Subject must be between 1 and 100 characters");
    });

    it("should validate message length", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "Help",
          message: "",
          priority: "medium",
        })
      ).rejects.toThrow("Message must be between 1 and 2000 characters");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "Help",
          message: "a".repeat(2001),
          priority: "medium",
        })
      ).rejects.toThrow("Message must be between 1 and 2000 characters");
    });

    it("should create ticket and update counters", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const result = await createTicketHandler(
        mockCtx as unknown as MutationCtx,
        {
          subject: " Help ",
          message: " I need help ",
          priority: "high",
          auctionId: "auction1" as Id<"auctions">,
        }
      );

      expect(result).toBe("ticket1");
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "supportTickets",
        expect.objectContaining({
          userId: "u1",
          subject: "Help",
          message: "I need help",
          priority: "high",
          auctionId: "auction1",
          status: "open",
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledTimes(2);
    });
  });

  describe("getMyTicketsHandler", () => {
    it("should return empty if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(0);
    });

    it("should return tickets for authenticated user", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const mockTickets = [{ _id: "t1", subject: "S1" }];
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue(mockTickets),
      });

      const result = await getMyTicketsHandler(mockCtx as unknown as QueryCtx, {
        limit: 10,
      });
      expect(result).toEqual(mockTickets);
      expect(mockCtx.db.query).toHaveBeenCalledWith("supportTickets");
    });

    it("should handle query errors gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.query = vi.fn().mockImplementation(() => {
        throw new Error("DB Error");
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
