import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render as rtlRender } from "@testing-library/react";
import * as convexReact from "convex/react";

import type { Id } from "../../convex/_generated/dataModel";
import { UserProfileProvider } from "./UserProfileContext";
import { useUserProfile } from "./useUserProfile";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

describe("UserProfileContext", () => {
  const mockUserProfile = {
    userId: "u123",
    _id: "p123",
    email: "test@example.com",
    profile: {
      userId: "u123",
      _id: "p123" as Id<"profiles">,
      _creationTime: Date.now(),
      role: "buyer" as const,
      isVerified: true,
      kycStatus: "verified" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    kyc: {
      firstName: "Test",
      lastName: "User",
      idNumber: "1234567890",
      phoneNumber: "+1234567890",
      kycEmail: "test@example.com",
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("UserProfileProvider", () => {
    it("should render children", () => {
      const { container } = render(
        <UserProfileProvider>
          <div>Test Content</div>
        </UserProfileProvider>
      );

      expect(container).toHaveTextContent("Test Content");
    });

    it("should provide user profile to children", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(mockUserProfile);

      const TestComponent = () => {
        const profile = useUserProfile();
        return <div>{profile?.email}</div>;
      };

      const { container } = render(
        <UserProfileProvider>
          <TestComponent />
        </UserProfileProvider>
      );

      expect(container).toHaveTextContent("test@example.com");
    });
  });

  describe("useUserProfile", () => {
    it("should return user profile when used within provider", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(mockUserProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: UserProfileProvider,
      });

      expect(result.current).toEqual(mockUserProfile);
    });

    it("should return undefined while loading", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: UserProfileProvider,
      });

      expect(result.current).toBeUndefined();
    });

    it("should return null when user has no profile", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(null);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: UserProfileProvider,
      });

      expect(result.current).toBeNull();
    });
  });
});

// Helper function to render components for testing
function render(element: ReactNode) {
  return rtlRender(element);
}
