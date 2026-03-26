import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

import {
  generateFingerprint,
  submitErrorReportHandler,
  getErrorReportsHandler,
  getErrorReportStatsHandler,
  processErrorReportsHandler,
} from "./errors";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import * as settings from "./admin/settings";
import * as auth from "./lib/auth";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

vi.mock("./admin/settings", () => ({
  getGitHubConfig: vi.fn(),
  isGitHubReportingEnabled: vi.fn(),
}));

vi.mock("./lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue(null as never),
}));

// Properly typed mock database to satisfy strict linting
interface MockDatabase {
  insert: Mock;
  patch: Mock;
  query: Mock;
}

const createMockCtx = (db: MockDatabase): MutationCtx => {
  return { db: db as unknown as MutationCtx["db"] } as MutationCtx;
};

const createMockQueryCtx = (db: MockDatabase): QueryCtx => {
  return { db: db as unknown as QueryCtx["db"] } as QueryCtx;
};

const createMockInternalCtx = (db: MockDatabase): MutationCtx => {
  return { db: db as unknown as MutationCtx["db"] } as MutationCtx;
};

describe("Errors Backend", () => {
  const now = Date.now();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    global.fetch = vi.fn();
    (auth.getAuthUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      _id: "u1",
      email: "admin@test.com",
      name: "Admin User",
      image: null,
      role: "admin",
      _creationTime: now,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateFingerprint", () => {
    it("should generate consistent fingerprint for same error", () => {
      const f1 = generateFingerprint(
        "TypeError",
        "Cannot read properties of undefined (reading 'foo')",
        null
      );
      const f2 = generateFingerprint(
        "TypeError",
        "Cannot read properties of undefined (reading 'foo')"
      );
      expect(f1).toBe(f2);
    });

    it("should normalize messages", () => {
      const f1 = generateFingerprint("TypeError", "Error 123");
      const f2 = generateFingerprint("TypeError", "Error   123!");
      expect(f1).toBe(f2);
    });

    it("should include top frame if available", () => {
      const stack = `TypeError: Cannot read properties of undefined (reading 'foo')
    at Object.<anonymous> (/app/src/test.ts:10:15)
    at Module._compile (node:internal/modules/cjs/loader:1356:14)`;

      const f1 = generateFingerprint("TypeError", "Test", stack);
      expect(f1).toBe("TypeError:test:Object.<anonymous>");
    });

    it("should skip empty lines and random garbage in stack trace", () => {
      const stack = `TypeError: Something went wrong
      
      random line that does not start with at or TypeError
      at MyFunction (/app/src/test.ts:1:1)`;

      const f1 = generateFingerprint("TypeError", "Test", stack);
      expect(f1).toBe("TypeError:test:MyFunction");
    });

    it("covers no stack trace case", () => {
      expect(generateFingerprint("Error", "Message")).toBe("Error:message:");
    });

    it("covers non-standard stack frame format", () => {
      const stack = "Error: msg\n  at /path/to/file.ts:1:1"; // No function name
      expect(generateFingerprint("Error", "msg", stack)).toBe(
        "Error:msg:/path/to/file.ts:1:1"
      );
    });

    it("skips non-matching lines in stack trace", () => {
      const stack =
        "Random line\nTypeError: Specific Error\nAnother line\nat MyFunc (file.ts:1:1)";
      expect(generateFingerprint("Error", "msg", stack)).toBe(
        "Error:msg:MyFunc"
      );
    });

    it("covers non-matching at lines branch", () => {
      // Test the "continue" branch for lines that don't start with "at " or "TypeError"
      const stack = "Just some text\nMore text";
      expect(generateFingerprint("Error", "msg", stack)).toBe("Error:msg:");
    });
  });

  describe("submitErrorReport", () => {
    const setupMockCtx = (
      existingReports: Partial<Doc<"errorReports">>[] = []
    ) => {
      const mockQ = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        field: vi.fn((f) => f),
      };
      const queryMock = {
        withIndex: vi.fn((_name, cb) => {
          if (typeof cb === "function") cb(mockQ);
          return queryMock;
        }),
        filter: vi.fn((cb) => {
          if (typeof cb === "function") cb(mockQ);
          return queryMock;
        }),
        collect: vi.fn().mockResolvedValue(existingReports),
        take: vi.fn().mockResolvedValue(existingReports),
      };
      const mockDb: MockDatabase = {
        insert: vi.fn().mockResolvedValue("new_id" as Id<"errorReports">),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockReturnValue(queryMock),
      };
      return createMockCtx(mockDb);
    };

    it("should create a new report if no duplicate exists", async () => {
      const mockCtx = setupMockCtx([]);
      const args = {
        errorType: "Error",
        errorMessage: "New error",
        breadcrumbs: [],
        metadata: { url: "test", userAgent: "test", timestamp: now },
        userId: "test-user-id",
      };

      const result = await submitErrorReportHandler(mockCtx, args);

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.instanceCount).toBe(1);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "errorReports",
        expect.objectContaining({
          errorType: "Error",
          errorMessage: "New error",
          userId: "u1",
          instanceCount: 1,
        })
      );
    });

    it("should increment instanceCount if duplicate exists within 24h", async () => {
      const existing = {
        _id: "existing_id" as Id<"errorReports">,
        fingerprint: generateFingerprint("Error", "Duplicate"),
        instanceCount: 5,
        lastOccurredAt: now - 1000,
        userId: "old_user",
      };
      const mockCtx = setupMockCtx([existing]);

      const args = {
        errorType: "Error",
        errorMessage: "Duplicate",
        breadcrumbs: [],
        metadata: { url: "test", userAgent: "test", timestamp: now },
        userId: "new_user",
      };

      const result = await submitErrorReportHandler(mockCtx, args);

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.instanceCount).toBe(6);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "existing_id",
        expect.objectContaining({
          instanceCount: 6,
          userId: "u1",
        })
      );
    });

    it("should increment instanceCount if duplicate exists within 24h", async () => {
      const existing = {
        _id: "existing_id" as Id<"errorReports">,
        fingerprint: generateFingerprint("Error", "Duplicate"),
        instanceCount: 5,
        lastOccurredAt: now - 1000,
        userId: "old_user",
      };
      const mockCtx = setupMockCtx([existing]);

      const args = {
        errorType: "Error",
        errorMessage: "Duplicate",
        breadcrumbs: [],
        metadata: { url: "test", userAgent: "test", timestamp: now },
        userId: "new_user",
      };

      const result = await submitErrorReportHandler(mockCtx, args);

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.instanceCount).toBe(6);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "existing_id",
        expect.objectContaining({
          instanceCount: 6,
          userId: "u1",
        })
      );
    });

    it("should handle existing reports older than 24h as new", async () => {
      const existing = {
        _id: "old_id" as Id<"errorReports">,
        fingerprint: generateFingerprint("Error", "Old"),
        instanceCount: 1,
        lastOccurredAt: now - (TWENTY_FOUR_HOURS_MS + 1000),
      };
      const mockCtx = setupMockCtx([existing]);

      const args = {
        errorType: "Error",
        errorMessage: "Old",
        breadcrumbs: [],
        metadata: { url: "test", userAgent: "test", timestamp: now },
      };

      const result = await submitErrorReportHandler(mockCtx, args);
      expect(result.isDuplicate).toBe(false);
      expect(mockCtx.db.insert).toHaveBeenCalled();
    });
  });

  describe("getErrorReports", () => {
    it("should return reports for admin", async () => {
      const mockReports = [
        {
          _id: "1",
          status: "pending" as const,
          errorMessage: "Error 1",
          instanceCount: 1,
          lastOccurredAt: 123,
          _creationTime: 123,
          fingerprint: "f1",
          errorType: "T1",
        },
      ];
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          order: vi.fn(() => ({
            take: vi.fn().mockResolvedValue(mockReports),
          })),
        })),
      };
      const mockCtx = createMockQueryCtx(mockDb);

      const result = await getErrorReportsHandler(mockCtx, { limit: 10 });
      expect(result.reports).toHaveLength(1);
      expect(result.reports[0].errorMessage).toBe("Error 1");
    });

    it("should filter by status and use default limit", async () => {
      const mockTake = vi.fn().mockResolvedValue([]);
      const mockOrder = vi.fn(() => ({ take: mockTake }));
      const mockFilter = vi.fn(() => ({ order: mockOrder }));
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          filter: mockFilter,
          order: mockOrder,
        })),
      };
      const mockCtx = createMockQueryCtx(mockDb);

      // Test with status
      await getErrorReportsHandler(mockCtx, { status: "completed" });
      expect(mockFilter).toHaveBeenCalled();

      // Test default limit
      await getErrorReportsHandler(mockCtx, {});
      expect(mockTake).toHaveBeenCalledWith(50);
    });
  });

  describe("getErrorReportStats", () => {
    it("should return counts for each status fully", async () => {
      const mockReports = [
        { status: "pending" },
        { status: "processing" },
        { status: "completed" },
        { status: "failed" },
      ];
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          collect: vi.fn().mockResolvedValue(mockReports),
        })),
      };
      const mockCtx = createMockQueryCtx(mockDb);

      const result = await getErrorReportStatsHandler(mockCtx);
      expect(result).toEqual({
        pending: 1,
        processing: 1,
        completed: 1,
        failed: 1,
        total: 4,
      });
    });
  });

  describe("processErrorReports", () => {
    const setupMockCtx = (
      pendingReports: Partial<Doc<"errorReports">>[] = []
    ) => {
      const mockQ = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        field: vi.fn((f) => f),
      };
      const queryMock = {
        withIndex: vi.fn((_name, cb) => {
          if (typeof cb === "function") cb(mockQ);
          return queryMock;
        }),
        filter: vi.fn((cb) => {
          if (typeof cb === "function") cb(mockQ);
          return queryMock;
        }),
        take: vi.fn().mockResolvedValue(pendingReports),
      };
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockReturnValue(queryMock),
      };
      return createMockInternalCtx(mockDb);
    };

    it("should skip if disabled or config missing", async () => {
      // Disabled
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(false);
      const mockCtxDisabled = setupMockCtx();
      let result = await processErrorReportsHandler(mockCtxDisabled);
      expect(result.processed).toBe(0);

      // Config missing token
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: null,
        repoOwner: "owner",
        repoName: "repo",
        labels: "bug",
      });
      const mockCtxMissingToken = setupMockCtx();
      result = await processErrorReportsHandler(mockCtxMissingToken);
      expect(result.processed).toBe(0);

      // Config missing repoOwner
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "token",
        repoOwner: null,
        repoName: "repo",
        labels: "bug",
      });
      result = await processErrorReportsHandler(setupMockCtx());
      expect(result.processed).toBe(0);
    });

    it("should skip if repoOwner or repoName is missing", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);

      // Missing repoName
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: "o",
        repoName: null,
        labels: "b",
      });
      let result = await processErrorReportsHandler(setupMockCtx([]));
      expect(result.processed).toBe(0);

      // Missing repoOwner
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: null,
        repoName: "r",
        labels: "b",
      });
      result = await processErrorReportsHandler(setupMockCtx([]));
      expect(result.processed).toBe(0);
    });

    it("should process pending reports and handle GitHub actions", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "token",
        repoOwner: "owner",
        repoName: "repo",
        labels: "bug",
      });

      const mockReports: Partial<Doc<"errorReports">>[] = [
        // New issue
        {
          _id: "r1" as Id<"errorReports">,
          status: "pending" as const,
          errorType: "TypeError",
          errorMessage: "New error",
          instanceCount: 1,
          breadcrumbs: [{ timestamp: now, type: "t", description: "d" }],
          metadata: { url: "u", userAgent: "ua", timestamp: now },
        },
        // Comment on existing
        {
          _id: "r2" as Id<"errorReports">,
          status: "pending" as const,
          errorType: "TypeError",
          errorMessage: "Duplicate error",
          instanceCount: 2,
          githubIssueNumber: 123,
          breadcrumbs: [],
          metadata: { url: "u", userAgent: "ua", timestamp: now },
          lastOccurredAt: now,
        },
      ];
      const mockCtx = setupMockCtx(mockReports);

      vi.mocked(global.fetch).mockImplementation((url) => {
        if (url.toString().includes("comments")) {
          return Promise.resolve({ ok: true } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ number: 456, html_url: "h456" }),
        } as Response);
      });

      const promise = processErrorReportsHandler(mockCtx);
      await vi.advanceTimersByTimeAsync(1000); // 2 reports * 500ms
      const result = await promise;

      expect(result.processed).toBe(2);
      expect(result.created).toBe(1);
      expect(result.commented).toBe(1);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          status: "completed",
          githubIssueUrl: "h456",
          githubIssueNumber: 456,
        })
      );
    });

    it("should reset status to pending on 403 or 429 GitHub API response", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: "o",
        repoName: "r",
        labels: "b",
      });

      const report = {
        _id: "r1" as Id<"errorReports">,
        status: "pending" as const,
        errorType: "E",
        errorMessage: "M",
        instanceCount: 1,
        breadcrumbs: [],
        metadata: { url: "u", userAgent: "ua", timestamp: now },
      };
      const mockCtx = setupMockCtx([report]);

      // Mock rate limit
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate Limit Exceeded"),
      } as Response);

      const promise = processErrorReportsHandler(mockCtx);
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(mockCtx.db.patch).toHaveBeenCalledWith("r1", {
        status: "pending",
      });
    });

    it("should handle GitHub API errors", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: "o",
        repoName: "r",
        labels: "b",
      });

      const report = {
        _id: "r1" as Id<"errorReports">,
        status: "pending" as const,
        errorType: "E",
        errorMessage: "M",
        instanceCount: 1,
        breadcrumbs: [],
        metadata: { url: "u", userAgent: "ua", timestamp: now },
      };
      const mockCtx = setupMockCtx([report]);

      // General error (500)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      } as Response);

      const promise = processErrorReportsHandler(mockCtx);
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;
      expect(result.failed).toBe(1);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("r1", { status: "failed" });
    });

    it("should throw error when comment request fails with non-ok response", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: "o",
        repoName: "r",
        labels: "b",
      });

      const report = {
        _id: "r1" as Id<"errorReports">,
        status: "pending" as const,
        errorType: "E",
        errorMessage: "M",
        instanceCount: 1,
        githubIssueNumber: 123,
        breadcrumbs: [],
        metadata: { url: "u", userAgent: "ua", timestamp: now },
        lastOccurredAt: now,
      };
      const mockCtx = setupMockCtx([report]);

      // Mock first fetch for issues to return not found (so it goes to comment path)
      // and second fetch for comments to return non-ok
      vi.mocked(global.fetch).mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes("comments")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve("Comment failed"),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ number: 123, html_url: "h123" }),
        } as Response);
      });

      const promise = processErrorReportsHandler(mockCtx);
      await vi.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.failed).toBe(1);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("r1", { status: "failed" });
    });

    it("should call take with BATCH_SIZE limit", async () => {
      vi.mocked(settings.isGitHubReportingEnabled).mockResolvedValue(true);
      vi.mocked(settings.getGitHubConfig).mockResolvedValue({
        enabled: true,
        token: "t",
        repoOwner: "o",
        repoName: "r",
        labels: "b",
      });

      const mockReports = Array.from({ length: 10 }, (_, i) => ({
        _id: `r${i}` as Id<"errorReports">,
        status: "pending" as const,
        errorType: "E",
        errorMessage: `M${i}`,
        instanceCount: 1,
        breadcrumbs: [],
        metadata: { url: "u", userAgent: "ua", timestamp: now },
      }));

      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            filter: vi.fn(() => ({
              take: vi.fn().mockImplementation((limit: number) => {
                return Promise.resolve(mockReports.slice(0, limit));
              }),
            })),
          })),
        })),
      };
      const mockCtx = createMockInternalCtx(mockDb);

      vi.mocked(global.fetch).mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ number: 1, html_url: "h1" }),
        } as Response);
      });

      const promise = processErrorReportsHandler(mockCtx);
      await vi.advanceTimersByTimeAsync(2500);
      const result = await promise;

      expect(result.processed).toBe(5);
    });
  });

  describe("Entry Points Coverage", () => {
    it("getErrorReportsHandler should handle missing status", async () => {
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          order: vi.fn(() => ({
            take: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      const mockCtx = createMockQueryCtx(mockDb);
      const result = await getErrorReportsHandler(mockCtx, { limit: 10 });
      expect(result.reports).toEqual([]);
    });

    it("getErrorReportStatsHandler should return stats", async () => {
      const mockDb: MockDatabase = {
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          collect: vi
            .fn()
            .mockResolvedValue([
              { status: "pending" },
              { status: "completed" },
            ]),
        })),
      };
      const mockCtx = createMockQueryCtx(mockDb);
      const result = await getErrorReportStatsHandler(mockCtx);
      expect(result.total).toBe(2);
      expect(result.pending).toBe(1);
      expect(result.completed).toBe(1);
    });
  });
});
