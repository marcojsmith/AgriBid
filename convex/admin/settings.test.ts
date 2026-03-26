import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getGitHubConfig,
  isGitHubReportingEnabled,
  getSystemConfigHandler,
  updateSystemConfigHandler,
  getSetting,
} from "./settings";
import * as adminUtils from "../admin_utils";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import * as auth from "../lib/auth";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  logAudit: vi.fn(),
  decryptPII: vi
    .fn()
    .mockImplementation((val: string) =>
      Promise.resolve(val.replace("encrypted_", ""))
    ),
  encryptPII: vi
    .fn()
    .mockImplementation((val: string) => Promise.resolve(`encrypted_${val}`)),
}));

describe("Settings Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockCtx = (settingsMap: Record<string, unknown>) => {
    let currentKey = "";
    const mockDb = {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn((_idx, cb) => {
          const q = {
            eq: vi.fn((_field, val) => {
              currentKey = val as string;
              return q;
            }),
          };
          if (cb) (cb as (q: unknown) => void)(q);
          return {
            unique: vi.fn().mockImplementation(() => {
              const value = settingsMap[currentKey];
              return Promise.resolve(value !== undefined ? { value } : null);
            }),
            collect: vi.fn().mockImplementation(() => {
              return Promise.resolve(
                Object.entries(settingsMap).map(([key, value]) => ({
                  key,
                  value,
                  updatedAt: Date.now(),
                }))
              );
            }),
          };
        }),
        collect: vi.fn().mockImplementation(() => {
          return Promise.resolve(
            Object.entries(settingsMap).map(([key, value]) => ({
              key,
              value,
              updatedAt: Date.now(),
            }))
          );
        }),
      }),
      insert: vi.fn().mockResolvedValue("new_id"),
      patch: vi.fn().mockResolvedValue(undefined),
    };

    return { db: mockDb as unknown as QueryCtx["db"] } as QueryCtx;
  };

  describe("getGitHubConfig", () => {
    it("returns disabled if not enabled", async () => {
      const ctx = createMockCtx({ github_error_reporting_enabled: false });
      const config = await getGitHubConfig(ctx);
      expect(config.enabled).toBe(false);
      expect(config.token).toBeNull();
    });

    it("returns parsed config if enabled", async () => {
      const ctx = createMockCtx({
        github_error_reporting_enabled: true,
        github_api_token: "encrypted_token123",
        github_repo_owner: "testowner",
        github_repo_name: "testrepo",
        github_error_labels: "bug",
      });

      const config = await getGitHubConfig(ctx);
      expect(config.enabled).toBe(true);
      expect(config.token).toBe("token123");
      expect(config.repoOwner).toBe("testowner");
      expect(config.repoName).toBe("testrepo");
      expect(config.labels).toBe("bug");
      expect(adminUtils.decryptPII).toHaveBeenCalledWith("encrypted_token123");
    });
  });

  describe("isGitHubReportingEnabled", () => {
    it("returns false if disabled", async () => {
      const ctx = createMockCtx({ github_error_reporting_enabled: false });
      const enabled = await isGitHubReportingEnabled(ctx);
      expect(enabled).toBe(false);
    });

    it("returns true if fully configured", async () => {
      const ctx = createMockCtx({
        github_error_reporting_enabled: true,
        github_api_token: "encrypted_token123",
        github_repo_owner: "testowner",
        github_repo_name: "testrepo",
      });
      const enabled = await isGitHubReportingEnabled(ctx);
      expect(enabled).toBe(true);
    });
  });

  describe("getSystemConfig", () => {
    it("returns full system config for admin", async () => {
      const settingsMap = {
        pagination_default_limit: 20,
        github_error_reporting_enabled: true,
        github_api_token: "encrypted_token",
      };
      const ctx = createMockCtx(settingsMap);

      const result = await getSystemConfigHandler(ctx);

      expect(auth.requireAdmin).toHaveBeenCalledWith(ctx);
      expect(result.githubConfig.enabled).toBe(true);
      expect(result.githubConfig.tokenMasked).toBe("****oken");
    });
  });

  describe("updateSystemConfig", () => {
    it("updates non-sensitive setting directly", async () => {
      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn(() => ({
            unique: vi.fn().mockResolvedValue(null),
          })),
        }),
        insert: vi.fn().mockResolvedValue("new_id"),
        patch: vi.fn(),
      };
      const ctx = { db: mockDb as unknown as MutationCtx["db"] } as MutationCtx;
      const args = { key: "pagination_default_limit", value: 50 };

      await updateSystemConfigHandler(ctx, args);

      expect(auth.requireAdmin).toHaveBeenCalled();
      expect(mockDb.patch).not.toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(
        "settings",
        expect.objectContaining({
          key: "pagination_default_limit",
          value: 50,
        })
      );
    });

    it("encrypts GitHub API token before saving", async () => {
      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn(() => ({
            unique: vi.fn().mockResolvedValue(null),
          })),
        }),
        insert: vi.fn().mockResolvedValue("new_id"),
      };
      const ctx = { db: mockDb as unknown as MutationCtx["db"] } as MutationCtx;
      const args = { key: "github_api_token", value: "new_token" };

      await updateSystemConfigHandler(ctx, args);

      expect(adminUtils.encryptPII).toHaveBeenCalledWith("new_token");
      expect(mockDb.insert).toHaveBeenCalledWith(
        "settings",
        expect.objectContaining({
          key: "github_api_token",
          value: "encrypted_new_token",
        })
      );
    });

    it("patches existing setting if it already exists", async () => {
      const existingSetting = {
        _id: "s1",
        key: "pagination_default_limit",
        value: 20,
      };
      let currentKey = "";
      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn((_idx, cb) => {
            const q = {
              eq: vi.fn((_field, val) => {
                currentKey = val as string;
                return q;
              }),
            };
            if (cb) (cb as (q: unknown) => void)(q);
            return {
              unique: vi.fn().mockImplementation(() => {
                return Promise.resolve(
                  currentKey === "pagination_default_limit"
                    ? existingSetting
                    : null
                );
              }),
            };
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn(),
      };
      const ctx = { db: mockDb as unknown as MutationCtx["db"] } as MutationCtx;

      await updateSystemConfigHandler(ctx, {
        key: "pagination_default_limit",
        value: 100,
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          value: 100,
        })
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("throws error for invalid setting key", async () => {
      const ctx = createMockCtx({});
      await expect(
        updateSystemConfigHandler(ctx as unknown as MutationCtx, {
          key: "invalid_key",
          value: "val",
        })
      ).rejects.toThrow("Invalid setting key: invalid_key");
    });

    it("throws error for invalid value type", async () => {
      const ctx = createMockCtx({});
      await expect(
        updateSystemConfigHandler(ctx as unknown as MutationCtx, {
          key: "pagination_default_limit",
          value: "not a number",
        })
      ).rejects.toThrow(
        "Invalid type for setting pagination_default_limit: expected number"
      );
    });

    it("throws error for non-positive integer for numeric settings", async () => {
      const ctx = createMockCtx({});
      await expect(
        updateSystemConfigHandler(ctx as unknown as MutationCtx, {
          key: "pagination_default_limit",
          value: 0,
        })
      ).rejects.toThrow(
        "Setting pagination_default_limit must be a positive integer"
      );

      await expect(
        updateSystemConfigHandler(ctx as unknown as MutationCtx, {
          key: "pagination_default_limit",
          value: 6000,
        })
      ).rejects.toThrow("Setting pagination_default_limit cannot exceed 5000");
    });
  });

  describe("getGitHubConfig Edge Cases", () => {
    it("handles decryption failure gracefully", async () => {
      vi.mocked(adminUtils.decryptPII).mockRejectedValueOnce(
        new Error("Decryption failed")
      );
      const ctx = createMockCtx({
        github_error_reporting_enabled: true,
        github_api_token: "encrypted_bad_token",
      });
      const config = await getGitHubConfig(ctx);
      expect(config.token).toBeNull();
    });

    it("handles type mismatch in getSetting", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ctx = createMockCtx({
        github_repo_owner: 123, // Expected string
      });

      const result = await getSetting(ctx, "github_repo_owner", "default");
      expect(result).toBe("default");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("type mismatch")
      );
      consoleSpy.mockRestore();
    });

    it("handles missing or non-string token branch", async () => {
      const ctx = createMockCtx({
        github_error_reporting_enabled: true,
        github_api_token: undefined, // Missing
      });
      const config = await getGitHubConfig(ctx);
      expect(config.token).toBeNull();
    });

    it("getSystemConfigHandler handles masked token when missing", async () => {
      const ctx = createMockCtx({
        github_error_reporting_enabled: true,
        github_api_token: undefined,
      });
      const result = await getSystemConfigHandler(ctx as unknown as QueryCtx);
      expect(result.githubConfig.tokenMasked).toBe("");
    });
  });
});
