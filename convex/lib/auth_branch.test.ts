import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { getAuthUser, getAuthWithProfile } from "./auth";
import type { QueryCtx } from "../_generated/server";

interface MockCtx {
  auth: { getUserIdentity: Mock };
  db: { query: Mock };
}

describe("Auth Branch Coverage Expansion", () => {
  let mockCtx: MockCtx;
  let queryMock: { withIndex: Mock; unique: Mock };

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn(),
    };
    mockCtx = {
      auth: {
        getUserIdentity: vi.fn(),
      },
      db: {
        query: vi.fn(() => queryMock),
      },
    };
  });

  describe("getAuthUser mapping branches", () => {
    it("should default missing optional claims to null", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "user_abc" });

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toEqual({
        _id: "user_abc",
        userId: "user_abc",
        email: null,
        name: null,
        image: null,
      });
    });

    it("should preserve empty-string claims instead of coercing them to null", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        email: "",
        name: "",
        pictureUrl: "",
      });

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toEqual({
        _id: "user_abc",
        userId: "user_abc",
        email: "",
        name: "",
        image: "",
      });
    });
  });

  describe("getAuthWithProfile branches", () => {
    it("should return null if getAuthUser returns null (no identity) without querying profiles", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);

      expect(
        await getAuthWithProfile(mockCtx as unknown as QueryCtx)
      ).toBeNull();
      expect(queryMock.withIndex).not.toHaveBeenCalled();
    });

    it("should return authUser, profile and userId on success", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({
        subject: "user_abc",
        email: "abc@test.com",
      });
      const profile = { role: "seller", isVerified: true };
      queryMock.unique.mockResolvedValue(profile);

      const result = await getAuthWithProfile(mockCtx as unknown as QueryCtx);

      expect(result).toEqual({
        authUser: {
          _id: "user_abc",
          userId: "user_abc",
          email: "abc@test.com",
          name: null,
          image: null,
        },
        profile,
        userId: "user_abc",
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_userId",
        expect.any(Function)
      );
    });
  });
});
