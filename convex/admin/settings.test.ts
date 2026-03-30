import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getGitHubConfig,
  isGitHubReportingEnabled,
  getSystemConfigHandler,
  updateSystemConfigHandler,
  updateGitHubErrorReportingConfigHandler,
  getSetting,
  getBusinessInfoHandler,
  updateBusinessInfoHandler,
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

    it("rejects GitHub API token keys", async () => {
      const ctx = createMockCtx({});
      const args = { key: "github_api_token", value: "new_token" };

      await expect(
        updateSystemConfigHandler(ctx as unknown as MutationCtx, args)
      ).rejects.toThrow(
        "Use updateGitHubErrorReportingConfig for GitHub error-reporting settings"
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

  describe("updateGitHubErrorReportingConfig", () => {
    it("encrypts GitHub API token before saving if provided", async () => {
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
      const args = {
        enabled: true,
        token: "secret_token",
        repoOwner: "owner",
        repoName: "repo",
        labels: "bug",
      };

      await updateGitHubErrorReportingConfigHandler(ctx, args);

      expect(adminUtils.encryptPII).toHaveBeenCalledWith("secret_token");
      expect(mockDb.insert).toHaveBeenCalledWith(
        "settings",
        expect.objectContaining({
          key: "github_api_token",
          value: "encrypted_secret_token",
        })
      );
    });

    it("does not update token if not provided", async () => {
      const mockDb = {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn((_idx, cb) => {
            let result: { value: string } | null = null;
            const q = {
              eq: vi.fn((_field, val) => {
                if (val === "github_api_token") {
                  result = { value: "encrypted_old" };
                }
                return q;
              }),
            };
            if (cb) (cb as (q: unknown) => void)(q);
            return {
              unique: vi.fn().mockResolvedValue(result),
            };
          }),
        }),
        insert: vi.fn().mockResolvedValue("new_id"),
        patch: vi.fn(),
      };
      const ctx = { db: mockDb as unknown as MutationCtx["db"] } as MutationCtx;
      const args = {
        enabled: true,
        repoOwner: "owner",
        repoName: "repo",
        labels: "bug",
      };

      await updateGitHubErrorReportingConfigHandler(ctx, args);

      expect(adminUtils.encryptPII).not.toHaveBeenCalled();
      // Should not insert a new token key
      const tokenInsert = mockDb.insert.mock.calls.find(
        (call) => call[1].key === "github_api_token"
      );
      expect(tokenInsert).toBeUndefined();
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

  describe("getBusinessInfoHandler", () => {
    it("returns all nulls when no business keys are set", async () => {
      const ctx = createMockCtx({});
      const result = await getBusinessInfoHandler(ctx as QueryCtx);

      expect(result.businessName).toBeNull();
      expect(result.businessDescription).toBeNull();
      expect(result.streetAddress).toBeNull();
      expect(result.addressLocality).toBeNull();
      expect(result.addressCountry).toBeNull();
      expect(result.postalCode).toBeNull();
      expect(result.telephone).toBeNull();
      expect(result.email).toBeNull();
      expect(result.website).toBeNull();
      expect(result.logoUrl).toBeNull();
      expect(result.sameAs).toBeNull();
    });

    it("returns stored values for all fields", async () => {
      const ctx = createMockCtx({
        "business.name": "AgriBid",
        "business.description": "Auction platform",
        "business.streetAddress": "123 Main St",
        "business.addressLocality": "Cape Town",
        "business.addressCountry": "ZA",
        "business.postalCode": "8001",
        "business.telephone": "+27-21-555-0123",
        "business.email": "info@agribid.co.za",
        "business.website": "https://agribid.co.za",
        "business.logoUrl": "https://agribid.co.za/logo.png",
        "business.sameAs":
          '["https://facebook.com/agribid","https://twitter.com/agribid"]',
      });
      const result = await getBusinessInfoHandler(ctx as QueryCtx);

      expect(result.businessName).toBe("AgriBid");
      expect(result.businessDescription).toBe("Auction platform");
      expect(result.streetAddress).toBe("123 Main St");
      expect(result.addressLocality).toBe("Cape Town");
      expect(result.addressCountry).toBe("ZA");
      expect(result.postalCode).toBe("8001");
      expect(result.telephone).toBe("+27-21-555-0123");
      expect(result.email).toBe("info@agribid.co.za");
      expect(result.website).toBe("https://agribid.co.za");
      expect(result.logoUrl).toBe("https://agribid.co.za/logo.png");
      expect(result.sameAs).toEqual([
        "https://facebook.com/agribid",
        "https://twitter.com/agribid",
      ]);
    });

    it("handles invalid JSON in sameAs gracefully", async () => {
      const ctx = createMockCtx({
        "business.sameAs": "not valid json",
      });
      const result = await getBusinessInfoHandler(ctx as QueryCtx);

      expect(result.sameAs).toEqual([]);
    });

    it("handles non-array JSON in sameAs gracefully", async () => {
      const ctx = createMockCtx({
        "business.sameAs": '"just a string"',
      });
      const result = await getBusinessInfoHandler(ctx as QueryCtx);

      expect(result.sameAs).toEqual([]);
    });
  });

  describe("updateBusinessInfo", () => {
    it("throws when called by non-admin", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValueOnce(
        new Error("Not admin")
      );
      const ctx = createMockCtx({});

      await expect(
        updateBusinessInfoHandler(ctx as unknown as MutationCtx, {
          businessName: "Test",
        })
      ).rejects.toThrow("Not admin");

      vi.mocked(auth.requireAdmin).mockReset();
    });

    it("saves and retrieves all fields correctly", async () => {
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

      await updateBusinessInfoHandler(ctx, {
        businessName: "AgriBid",
        businessDescription: "Auction platform",
        streetAddress: "123 Main St",
        addressLocality: "Cape Town",
        addressCountry: "ZA",
        postalCode: "8001",
        telephone: "+27-21-555-0123",
        email: "info@agribid.co.za",
        website: "https://agribid.co.za",
        logoUrl: "https://agribid.co.za/logo.png",
        sameAs: ["https://facebook.com/agribid"],
      });

      expect(auth.requireAdmin).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(11);

      const businessNameCall = mockDb.insert.mock.calls.find(
        (call) => call[1].key === "business.name"
      );
      expect(businessNameCall).toBeDefined();
      expect(businessNameCall?.[1].value).toBe("AgriBid");

      const sameAsCall = mockDb.insert.mock.calls.find(
        (call) => call[1].key === "business.sameAs"
      );
      expect(sameAsCall).toBeDefined();
      expect(sameAsCall?.[1].value).toBe('["https://facebook.com/agribid"]');
    });

    it("logs audit with correct arguments on success", async () => {
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

      await updateBusinessInfoHandler(ctx, {
        businessName: "Test Business",
      });

      expect(adminUtils.logAudit).toHaveBeenCalledWith(ctx, {
        action: "UPDATE_SETTING",
        targetId: "business-info",
        targetType: "setting",
        details: expect.stringContaining("business.name"),
      });
    });

    it("patches existing setting if it already exists", async () => {
      const existingSetting = {
        _id: "s1",
        key: "business.name",
        value: "Old Name",
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
                  currentKey === "business.name" ? existingSetting : null
                );
              }),
            };
          }),
        }),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue("new_id"),
      };
      const ctx = { db: mockDb as unknown as MutationCtx["db"] } as MutationCtx;

      await updateBusinessInfoHandler(ctx, {
        businessName: "New Name",
      });

      expect(mockDb.patch).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          value: "New Name",
        })
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
