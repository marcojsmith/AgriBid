import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { getAuthUser, getAuthWithProfile } from "./auth";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

interface MockCtx {
  auth: {
    getUserIdentity: Mock;
  };
  db: {
    get: Mock;
    query: Mock;
  };
  runQuery: Mock;
}

describe("Auth Branch Coverage Expansion", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      auth: {
        getUserIdentity: vi.fn(),
      },
      db: {
        get: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn(),
        })),
      },
      runQuery: vi.fn(),
    };
  });

  describe("getAuthUser fallback branches", () => {
    it("should handle ArgumentValidationError where db.get returns null and adapter lookup also returns null", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("ArgumentValidationError")
      );
      mockCtx.db.get.mockResolvedValue(null);

      (authComponent as unknown as { adapter: unknown }).adapter = {
        findOne: "find",
      };
      mockCtx.runQuery.mockResolvedValue(null);

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
    });

    it("should handle ArgumentValidationError where db.get throws and adapter lookup succeeds with fallback fields", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("ArgumentValidationError")
      );
      mockCtx.db.get.mockRejectedValue(new Error("Bad ID"));

      (authComponent as unknown as { adapter: unknown }).adapter = {
        findOne: "find",
      };
      mockCtx.runQuery.mockResolvedValue({
        // Missing _id and userId to test ?? fallback
        email: "fallback@test.com",
      });

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result?._id).toBe("s1");
      expect(result?.userId).toBe("s1");
      expect(result?.email).toBe("fallback@test.com");
    });

    it("should handle Unauthenticated error without logging to console.error", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle case where identity.subject is truthy (False branch of line 63)", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        _creationTime: Date.now(),
        name: "Test User",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result).not.toBeNull();
    });
  });

  describe("getAuthWithProfile branches", () => {
    it("should return null if getAuthUser returns null (False branch of successful path)", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      const result = await getAuthWithProfile(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
    });
  });
});
