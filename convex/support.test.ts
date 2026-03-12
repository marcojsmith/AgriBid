import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { createTicketHandler } from "./support";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import type { MutationCtx } from "./_generated/server";
import type { AuthUser } from "./auth";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("./admin_utils", () => ({
  logAudit: vi.fn(),
  updateCounter: vi.fn(),
}));

describe("Support Coverage", () => {
  let mockCtx: {
    db: {
      insert: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        insert: vi.fn().mockResolvedValue("t1"),
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
});
