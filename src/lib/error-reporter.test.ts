import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  reportError,
  reportErrorAsync,
  sanitizeString,
  trackAndReport,
} from "./error-reporter";
import * as activityTracker from "./activity-tracker";
import * as errorClassifier from "./error-classifier";

vi.mock("../../convex/_generated/api", () => ({
  api: {
    errors: {
      submitErrorReport: "mocked_mutation",
    },
  },
}));

// Need to mock ConvexHttpClient
const mockMutation = vi.fn().mockResolvedValue({ success: true });

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class {
      mutation = mockMutation;
    },
  };
});

vi.mock("./activity-tracker", () => ({
  getBreadcrumbs: vi
    .fn()
    .mockReturnValue([{ type: "test", description: "test" }]),
  trackAction: vi.fn(),
}));

vi.mock("./error-classifier", () => ({
  shouldReportError: vi.fn().mockReturnValue(true),
}));

vi.mock("./utils", () => ({
  getErrorMessage: vi.fn((err: unknown, fallback: string) => {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    return fallback;
  }),
}));

describe("Error Reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_CONVEX_URL", "http://localhost:3210");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("sanitizeString", () => {
    it("should redact emails", () => {
      expect(sanitizeString("User user@example.com failed")).toBe(
        "User [EMAIL REDACTED] failed"
      );
    });

    it("should redact phone numbers", () => {
      expect(sanitizeString("Call 555-123-4567")).toBe("Call [PHONE REDACTED]");
      expect(sanitizeString("Call 1234567890")).toBe("Call [PHONE REDACTED]");
    });

    it("should redact IDs over 6 digits", () => {
      expect(sanitizeString("User 1234567 failed")).toBe(
        "User [ID REDACTED] failed"
      );
      expect(sanitizeString("Value 12345 is fine")).toBe("Value 12345 is fine");
    });
  });

  describe("reportError", () => {
    it("should return false if shouldReportError returns false", async () => {
      vi.mocked(errorClassifier.shouldReportError).mockReturnValueOnce(false);
      const result = await reportError(new Error("Validation error"));
      expect(result).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
    });

    it("should report an error and return true on success", async () => {
      const error = new Error("Test error");
      const context = { userId: "user-1", userRole: "admin" };

      const result = await reportError(error, context);

      expect(result).toBe(true);
      expect(mockMutation).toHaveBeenCalledTimes(1);

      // Vitest mock typing limitation: mock.calls returns unknown[] - safe here since we control the mock
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const args = mockMutation.mock.calls[0][1];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorType).toBe("Error");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorMessage).toBe("Test error");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.userId).toBe("user-1");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.userRole).toBe("admin");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.breadcrumbs).toHaveLength(1);
    });

    it("should handle string errors", async () => {
      const result = await reportError("String error");
      expect(result).toBe(true);

      // Vitest mock typing limitation: mock.calls returns unknown[]
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const args = mockMutation.mock.calls[0][1];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorType).toBe("Error"); // Defaults to Error for strings
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorMessage).toBe("String error");
    });

    it("should return false if VITE_CONVEX_URL is not set", async () => {
      vi.stubEnv("VITE_CONVEX_URL", "");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await reportError(new Error("Test error"));

      expect(result).toBe(false);
      expect(spy).toHaveBeenCalledWith(
        "Convex URL not configured, cannot report error"
      );
      spy.mockRestore();
    });

    it("should handle mutation errors gracefully", async () => {
      mockMutation.mockRejectedValueOnce(new Error("Network error"));

      const result = await reportError(new Error("Test error"));
      expect(result).toBe(false);
    });

    it("should handle non-Error, non-string errors by using fallback type and message", async () => {
      // Test for robustness: intentionally passing invalid type to verify fallback behavior
      const nonErrorObject = { foo: "bar" };
      const result = await reportError(nonErrorObject as unknown as Error);
      expect(result).toBe(true);

      // Vitest mock typing limitation: mock.calls returns unknown[]
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const args = mockMutation.mock.calls[0][1];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorType).toBe("Error");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(args.errorMessage).toBe("Unknown Error");
    });

    it("should return false and warn if VITE_CONVEX_URL is missing", async () => {
      vi.stubEnv("VITE_CONVEX_URL", "");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await reportError("test");
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Convex URL not configured")
      );
      spy.mockRestore();
    });
  });

  describe("reportErrorAsync", () => {
    it("should call reportError without awaiting", () => {
      // Very simple test for coverage
      reportErrorAsync(new Error("Test async"));
      expect(errorClassifier.shouldReportError).toHaveBeenCalled();
    });
  });

  describe("trackAndReport", () => {
    it("should track action and report error if provided", () => {
      trackAndReport("interaction", "Clicked bad button", new Error("Boom"));

      expect(activityTracker.trackAction).toHaveBeenCalledWith(
        "interaction",
        "Clicked bad button"
      );
      expect(errorClassifier.shouldReportError).toHaveBeenCalled();
    });

    it("should only track action if no error provided", () => {
      trackAndReport("interaction", "Clicked good button");

      expect(activityTracker.trackAction).toHaveBeenCalledWith(
        "interaction",
        "Clicked good button"
      );
      expect(errorClassifier.shouldReportError).not.toHaveBeenCalled();
    });
  });
});
