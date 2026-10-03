import { render, screen } from "@testing-library/react";
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

import { RouteErrorBoundary } from "./RouteErrorBoundary";

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
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
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

    const [error, context] = vi.mocked(errorReporter.reportErrorAsync).mock.calls[0];
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
