import { fireEvent, render, screen } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { MemoryRouter } from "react-router-dom";

import * as errorReporter from "@/lib/error-reporter";

import {
  RouteErrorBoundary,
  RouteErrorBoundaryBase,
} from "./RouteErrorBoundary";

vi.mock("@/lib/error-reporter", () => ({
  reportErrorAsync: vi.fn(),
}));

const ThrowingComponent = () => {
  throw new Error("Test error in route");
};

describe("RouteErrorBoundary", () => {
  let consoleErrorSpy: MockInstance<typeof console.error> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined;
    });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("renders children when there is no error", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <div>Normal content</div>
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders accessible fallback UI when a child throws", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <ThrowingComponent />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /something went wrong/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });

  it("reports the error through the error reporter", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <ThrowingComponent />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(errorReporter.reportErrorAsync).toHaveBeenCalledTimes(1);

    const [error, context] = vi.mocked(errorReporter.reportErrorAsync).mock
      .calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Test error in route");
    expect(context?.additionalInfo?.componentStack).toBeDefined();
  });

  it("provides a link to navigate home", () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <ThrowingComponent />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    const homeLink = screen.getByRole("link", { name: /go home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});

describe("RouteErrorBoundaryBase", () => {
  it("resets the error state when the location key changes", () => {
    const { rerender } = render(
      <MemoryRouter>
        <RouteErrorBoundaryBase locationKey="key-1">
          <ThrowingComponent />
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <RouteErrorBoundaryBase locationKey="key-2">
          <div>Recovered content</div>
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("keeps tracking the location key while no error is showing", () => {
    const { rerender } = render(
      <MemoryRouter>
        <RouteErrorBoundaryBase locationKey="key-1">
          <div>Content</div>
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );

    rerender(
      <MemoryRouter>
        <RouteErrorBoundaryBase locationKey="key-2">
          <div>Content</div>
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("clears the error state when Try Again is pressed", () => {
    const { rerender } = render(
      <MemoryRouter>
        <RouteErrorBoundaryBase>
          <ThrowingComponent />
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Re-render with healthy children so the retry can succeed once the state
    // is cleared.
    rerender(
      <MemoryRouter>
        <RouteErrorBoundaryBase>
          <div>Second attempt</div>
        </RouteErrorBoundaryBase>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Second attempt")).toBeInTheDocument();
  });

  it("describes string and structured non-Error throws", () => {
    expect(
      RouteErrorBoundaryBase.getDerivedStateFromError("string failure")
    ).toEqual({ hasError: true, errorMessage: "string failure" });

    expect(
      RouteErrorBoundaryBase.getDerivedStateFromError({ code: 42 })
    ).toEqual({ hasError: true, errorMessage: '{"code":42}' });
  });

  it("falls back to a generic message for unserializable and empty throws", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(RouteErrorBoundaryBase.getDerivedStateFromError(circular)).toEqual({
      hasError: true,
      errorMessage: "An unexpected error occurred",
    });
    expect(
      RouteErrorBoundaryBase.getDerivedStateFromError(new Error(""))
    ).toEqual({ hasError: true, errorMessage: "An unexpected error occurred" });
  });

  it("reports a missing component stack as a placeholder", () => {
    const instance = new RouteErrorBoundaryBase({ children: null });
    const reportSpy = vi
      .spyOn(errorReporter, "reportErrorAsync")
      .mockImplementation(() => undefined);

    instance.componentDidCatch(new Error("boom"), {
      componentStack: null as unknown as string,
    });

    expect(reportSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        additionalInfo: { componentStack: "No component stack" },
      })
    );
    reportSpy.mockRestore();
  });
});
