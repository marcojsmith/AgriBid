import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation } from "convex/react";

import { useSession } from "@/lib/auth-client";

import { Layout } from "./Layout";

function typedMutationMock<T>(_val: unknown): T {
  return _val as T;
}

// Mock Header and Footer to isolate Layout testing
vi.mock("./header/Header", () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

vi.mock("./Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

// Mock Convex hooks for NotificationListener inside Layout
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(),
  Authenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Unauthenticated: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock auth client for NotificationListener
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

describe("Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    vi.mocked(useMutation).mockReturnValue(
      typedMutationMock<ReturnType<typeof useMutation>>(
        vi.fn().mockResolvedValue({})
      )
    );
  });

  it("renders children and includes Header and Footer", () => {
    render(
      <BrowserRouter>
        <Layout>
          <div data-testid="child-content">Child Content</div>
        </Layout>
      </BrowserRouter>
    );

    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("handles syncUser failure", async () => {
    const mockSyncUser = vi.fn().mockRejectedValue(new Error("Sync Fail"));
    vi.mocked(useSession).mockReturnValue(
      typedMutationMock<ReturnType<typeof useSession>>({
        data: { user: { id: "user1" } },
        isPending: false,
      })
    );
    vi.mocked(useMutation).mockReturnValue(
      typedMutationMock<ReturnType<typeof useMutation>>(
        mockSyncUser.mockRejectedValue(new Error("Sync Fail"))
      )
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <BrowserRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockSyncUser).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to sync user:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
