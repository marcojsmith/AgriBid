import { renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as errorReporter from "@/lib/error-reporter";
import * as utils from "@/lib/utils";

import { useErrorHandler } from "./useErrorHandler";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/error-reporter", () => ({
  reportError: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/utils", () => ({
  getErrorMessage: vi.fn().mockReturnValue("Mocked error message"),
}));

describe("useErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show a toast and report to GitHub by default", async () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error("Test error");

    await result.current.handleError(error);

    expect(utils.getErrorMessage).toHaveBeenCalledWith(
      error,
      "An error occurred"
    );
    expect(toast.error).toHaveBeenCalledWith("Mocked error message");
    expect(errorReporter.reportError).toHaveBeenCalledWith(error, undefined);
  });

  it("should use a fallback message", async () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error("Test error");
    const fallback = "Custom fallback";

    await result.current.handleError(error, fallback);

    expect(utils.getErrorMessage).toHaveBeenCalledWith(error, fallback);
  });

  it("should not report to GitHub if reportToGitHub is false", async () => {
    const { result } = renderHook(() =>
      useErrorHandler({ reportToGitHub: false })
    );
    const error = new Error("Test error");

    await result.current.handleError(error);

    expect(toast.error).toHaveBeenCalled();
    expect(errorReporter.reportError).not.toHaveBeenCalled();
  });

  it("should pass context to reportError", async () => {
    const context = { userId: "user-1", userRole: "admin" };
    const { result } = renderHook(() => useErrorHandler({ context }));
    const error = new Error("Test error");

    await result.current.handleError(error);

    expect(errorReporter.reportError).toHaveBeenCalledWith(error, context);
  });

  it("should report string errors", async () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = "String error";

    await result.current.handleError(error);

    expect(errorReporter.reportError).toHaveBeenCalledWith(error, undefined);
  });

  it("should report fallback message if error is null", async () => {
    const { result } = renderHook(() => useErrorHandler());

    await result.current.handleError(null, "Fallback message");

    expect(errorReporter.reportError).toHaveBeenCalledWith(
      "Fallback message",
      undefined
    );
  });
});
