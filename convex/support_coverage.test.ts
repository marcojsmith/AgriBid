import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTicketHandler, getMyTicketsHandler } from "./support";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
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

  const mockUser = {
    userId: "u1",
  } as unknown as NonNullable<Awaited<ReturnType<typeof auth.getAuthUser>>>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        insert: vi.fn().mockResolvedValue("t1"),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([]),
        })),
      },
    };
  });

  describe("createTicketHandler", () => {
    it("should create a ticket", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const result = await createTicketHandler(
        mockCtx as unknown as MutationCtx,
        {
          subject: "Help",
          message: "Details",
          priority: "high" as const,
        }
      );

      expect(result).toBe("t1");
      expect(adminUtils.updateCounter).toHaveBeenCalled();
    });
  });

  describe("getMyTicketsHandler", () => {
    it("should return tickets", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      const result = await getMyTicketsHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(0);
    });
  });
});
