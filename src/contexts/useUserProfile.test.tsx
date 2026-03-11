import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useUserProfile } from "./useUserProfile";
import { UserProfileContext, type UserProfile } from "./user-profile-types";

describe("useUserProfile", () => {
  it("should throw error when used outside of Provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useUserProfile())).toThrow(
      "useUserProfile must be used within a UserProfileProvider"
    );

    consoleSpy.mockRestore();
  });

  it("should return context when used within Provider", () => {
    const mockProfile = { userId: "user-123", email: "test@example.com" };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProfileContext.Provider
        value={mockProfile as unknown as UserProfile}
      >
        {children}
      </UserProfileContext.Provider>
    );

    const { result } = renderHook(() => useUserProfile(), { wrapper });
    expect(result.current).toBe(mockProfile);
  });
});
