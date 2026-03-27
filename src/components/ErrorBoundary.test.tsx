import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as errorReporter from "@/lib/error-reporter";

import { ErrorBoundary } from "./ErrorBoundary";

vi.mock("@/lib/error-reporter", () => ({
  reportErrorAsync: vi.fn(),
}));

const ThrowError = () => {
  throw new Error("Test error rendering");
};

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    vi.unstubAllGlobals();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders fallback UI and reports error when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reload Page")).toBeInTheDocument();
    expect(screen.getByText("Go Back")).toBeInTheDocument();

    expect(errorReporter.reportErrorAsync).toHaveBeenCalledTimes(1);

    const [error, context] = vi.mocked(errorReporter.reportErrorAsync).mock
      .calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Test error rendering");
    expect(context?.additionalInfo?.componentStack).toBeDefined();
  });

  it("handles string errors thrown by children", () => {
    const ThrowString = () => {
      throw "String error";
    };

    render(
      <ErrorBoundary>
        <ThrowString />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(errorReporter.reportErrorAsync).toHaveBeenCalledWith(
      "String error",
      expect.any(Object)
    );
  });

  it("renders with a generic message if error has no message", () => {
    const ThrowEmpty = () => {
      throw new Error("");
    };

    render(
      <ErrorBoundary>
        <ThrowEmpty />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("provides functional reload and go back buttons", () => {
    const reloadSpy = vi.fn();
    const backSpy = vi.fn();

    vi.stubGlobal("location", { reload: reloadSpy } as unknown as Location);
    vi.stubGlobal("history", { back: backSpy } as unknown as History);

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText("Reload Page"));
    expect(reloadSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Go Back"));
    expect(backSpy).toHaveBeenCalled();
  });
});
