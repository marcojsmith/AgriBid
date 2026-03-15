import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { createTicketHandler, getMyTicketsHandler } from "./support";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AuthUser } from "./auth";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthUser: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("./admin_utils", () => ({
  logAudit: vi.fn(),
  updateCounter: vi.fn(),
}));

describe("Support Coverage", () => {
  interface MockCtx {
    db: {
      insert: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      withIndex: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      take: ReturnType<typeof vi.fn>;
    };
  }

  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        insert: vi.fn().mockResolvedValue("t1"),
        query: vi.fn().mockReturnThis(),
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        take: vi.fn().mockResolvedValue([]),
      },
    };
  });

  describe("createTicketHandler", () => {
    it("should create a ticket and return its ID", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      const args = {
        subject: "Help",
        message: "Need help",
        priority: "medium" as const,
      };

      const result = await createTicketHandler(
        mockCtx as unknown as MutationCtx,
        args
      );

      expect(result).toEqual("t1");
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "supportTickets",
        expect.objectContaining({
          userId: "user1",
          subject: "Help",
          status: "open",
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "support",
        "open",
        1
      );
    });

    it("should throw if user ID cannot be resolved", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "S",
          message: "M",
          priority: "low" as const,
        })
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should throw if subject is too short", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "",
          message: "M",
          priority: "low" as const,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if subject is too long", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "a".repeat(101),
          message: "M",
          priority: "low" as const,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if message is too short", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "S",
          message: "",
          priority: "low" as const,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if message is too long", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      await expect(
        createTicketHandler(mockCtx as unknown as MutationCtx, {
          subject: "S",
          message: "a".repeat(2001),
          priority: "low" as const,
        })
      ).rejects.toThrow(ConvexError);
    });
  });

  describe("getMyTicketsHandler", () => {
    it("should return user tickets", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      const mockTickets = [{ _id: "t1", subject: "Test" }];
      mockCtx.db.take.mockResolvedValue(mockTickets);

      const result = await getMyTicketsHandler(mockCtx as unknown as QueryCtx, {
        limit: 10,
      });

      expect(result).toEqual(mockTickets);
      expect(mockCtx.db.query).toHaveBeenCalledWith("supportTickets");
    });

    it("should return empty array if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);

      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toEqual([]);
    });

    it("should return empty array if userId resolution fails", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);

      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toEqual([]);
    });

    it("should handle unexpected errors gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toEqual([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle unauthenticated errors gracefully without logging", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated user")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should respect limit boundaries", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      await getMyTicketsHandler(mockCtx as unknown as QueryCtx, { limit: 200 });
      expect(mockCtx.db.take).toHaveBeenCalledWith(100);

      await getMyTicketsHandler(mockCtx as unknown as QueryCtx, { limit: -10 });
      expect(mockCtx.db.take).toHaveBeenCalledWith(1);
    });
  });
});
