import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./pages/NotFound", () => ({
  default: () => <div>not-found-page</div>,
}));
vi.mock("./pages/DesignSystem", () => ({
  default: () => <div>design-system-page</div>,
}));

/**
 * Loads a fresh copy of `App` after the DEV flag was stubbed (the route is
 * decided when the module is evaluated).
 *
 * @returns The freshly imported App component
 */
async function loadApp() {
  vi.resetModules();
  const mod = await import("./App");
  return mod.default;
}

describe("/design-system route", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/design-system");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.pushState({}, "", "/");
  });

  it("is registered in development", async () => {
    vi.stubEnv("DEV", true);
    const App = await loadApp();
    render(<App />);
    expect(await screen.findByText("design-system-page")).toBeInTheDocument();
  });

  it("is not registered outside development", async () => {
    vi.stubEnv("DEV", false);
    const App = await loadApp();
    render(<App />);
    expect(await screen.findByText("not-found-page")).toBeInTheDocument();
    expect(screen.queryByText("design-system-page")).not.toBeInTheDocument();
  });
});
