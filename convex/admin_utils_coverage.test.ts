import { describe, it, expect, vi, beforeEach } from "vitest";

import { countUsers, logAudit, updateCounter } from "./admin_utils";
import * as auth from "./lib/auth";
import type { MutationCtx, QueryCtx } from "./_generated/server";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
}));

describe("Admin Utils Coverage", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue([]),
        })),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn(),
      },
    };
  });

  describe("countUsers extra paths", () => {
    it("should handle isVerified: false with useCounter", async () => {
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue({ total: 100, verified: 40 }),
      });

      const result = await countUsers(mockCtx, {
        isVerified: false,
        useCounter: true,
      });
      expect(result).toBe(60);
    });

    it("should handle kycStatus filter in complex case", async () => {
      // kycStatus is present, but no role
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            collect: vi.fn().mockResolvedValue([
              { role: "buyer", kycStatus: "verified", isVerified: true },
              { role: "seller", kycStatus: "pending", isVerified: false },
            ]),
          };
        }
        return {
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        };
      });

      const result = await countUsers(mockCtx, {
        kycStatus: "pending",
        isVerified: false,
      });
      expect(result).toBe(1);
    });

    it("should handle isVerified filter in complex case", async () => {
      // only isVerified present but complex path triggered
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            collect: vi
              .fn()
              .mockResolvedValue([{ isVerified: true }, { isVerified: false }]),
          };
        }
        return {
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        };
      });

      // To trigger the else branch in complex case, we need NO role and NO kycStatus
      // But if we have isVerified, it will hit the 'else if (options.isVerified !== undefined)' branch.
      // To hit the final 'else' branch (results = ctx.db.query("profiles").collect()), we need NO filters at all.
      const result = await countUsers(mockCtx, {});
      expect(result).toBe(2);
    });
  });

  describe("logAudit extra paths", () => {
    it("should use _id if userId is missing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "auth123",
      } as Awaited<ReturnType<typeof auth.getAuthUser>>);

      await logAudit(mockCtx, { action: "TEST" });

      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auditLogs",
        expect.objectContaining({
          adminId: "auth123",
        })
      );
    });

    it("should warn if updateCounter fails in logAudit", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      // Mock updateCounter to fail
      // Since updateCounter is in the same file, we can't easily mock it without re-exporting.
      // But it's called internally. Let's make getCounter fail.
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockRejectedValue(new Error("DB Fail")),
      });
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await logAudit(mockCtx, { action: "TEST" });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update auditLogs counter"),
        expect.anything()
      );
      spy.mockRestore();
    });
  });

  describe("updateCounter initialization", () => {
    it("should initialize all fields when creating new counter", async () => {
      const fields = [
        "total",
        "active",
        "pending",
        "verified",
        "open",
        "resolved",
        "draft",
        "salesVolume",
        "soldCount",
      ] as const;

      for (const field of fields) {
        mockCtx.db.query = vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        });

        await updateCounter(mockCtx, "test", field, 10);

        expect(mockCtx.db.insert).toHaveBeenCalledWith(
          "counters",
          expect.objectContaining({
            [field]: 10,
          })
        );
      }
    });

    it("should warn on counter underflow", async () => {
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue({ _id: "c1", total: 5 }),
      });
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await updateCounter(mockCtx, "test", "total", -10);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Counter underflow")
      );
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          total: 0,
        })
      );
      spy.mockRestore();
    });
  });
});
