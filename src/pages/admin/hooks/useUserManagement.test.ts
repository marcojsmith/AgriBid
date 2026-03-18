import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { useUserManagement } from "./useUserManagement";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    users: {
      verifyUser: "users:verifyUser",
      promoteToAdmin: "users:promoteToAdmin",
      getProfileForKYC: "users:getProfileForKYC",
    },
    admin: {
      reviewKYC: "admin:reviewKYC",
    },
  },
}));

describe("useUserManagement hook", () => {
  const mockVerifyUser = vi.fn();
  const mockPromoteToAdmin = vi.fn();
  const mockReviewKYC = vi.fn();
  const mockGetProfileForKYC = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === "users:verifyUser") return mockVerifyUser;
      if (apiPath === "users:promoteToAdmin") return mockPromoteToAdmin;
      if (apiPath === "admin:reviewKYC") return mockReviewKYC;
      if (apiPath === "users:getProfileForKYC") return mockGetProfileForKYC;
      return vi.fn();
    });
  });

  describe("isKycReviewUser branches", () => {
    it("should return false for null or non-object", async () => {
      const { result } = renderHook(() => useUserManagement());

      mockGetProfileForKYC.mockResolvedValue(null);
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch profile details"
      );

      mockGetProfileForKYC.mockResolvedValue("not an object");
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(toast.error).toHaveBeenCalledTimes(2);
    });

    it("should return false if userId is not string or arrays are missing", async () => {
      const { result } = renderHook(() => useUserManagement());

      mockGetProfileForKYC.mockResolvedValue({ userId: 123 }); // Not string
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch profile details"
      );

      mockGetProfileForKYC.mockResolvedValue({
        userId: "u1",
        kycDocumentIds: "not array",
      });
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(toast.error).toHaveBeenCalledTimes(2);
    });
  });

  describe("handleReviewKYCClick branches", () => {
    it("should return immediately if already fetching", async () => {
      const { result } = renderHook(() => useUserManagement());

      // Setup a slow mutation
      let resolveMutation: (val: unknown) => void;
      mockGetProfileForKYC.mockReturnValue(
        new Promise((resolve) => {
          resolveMutation = resolve;
        })
      );

      let p1: Promise<void> | undefined;
      act(() => {
        p1 = result.current.handleReviewKYCClick("u1");
      });

      expect(result.current.isFetchingKYC).toBe(true);

      // Call again while fetching
      await act(async () => {
        await result.current.handleReviewKYCClick("u2");
      });

      expect(mockGetProfileForKYC).toHaveBeenCalledTimes(1); // Second call ignored

      await act(async () => {
        resolveMutation!({
          userId: "u1",
          kycDocumentIds: [],
          kycDocumentUrls: [],
        });
        await p1;
      });
    });
  });

  describe("handleManualVerify branches", () => {
    it("should not verify if already being verified", async () => {
      const { result } = renderHook(() => useUserManagement());

      let resolveVerify: (val: unknown) => void;
      mockVerifyUser.mockReturnValue(
        new Promise((resolve) => {
          resolveVerify = resolve;
        })
      );

      let p1: Promise<void> | undefined;
      act(() => {
        p1 = result.current.handleManualVerify("u1");
      });

      expect(result.current.verifyingUserIds.has("u1")).toBe(true);

      // Call again for same user
      await act(async () => {
        await result.current.handleManualVerify("u1");
      });

      expect(mockVerifyUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveVerify!(undefined);
        await p1;
      });
    });
  });

  describe("handleKycReview branches", () => {
    it("should return if no kycReviewUser", async () => {
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleKycReview("approve");
      });
      expect(mockReviewKYC).not.toHaveBeenCalled();
    });

    it("should return if rejecting without reason", async () => {
      const { result } = renderHook(() => useUserManagement());

      act(() => {
        result.current.setKycReviewUser({
          userId: "u1",
          kycDocumentIds: [],
          kycDocumentUrls: [],
        });
        result.current.setKycRejectionReason("   "); // Empty after trim
      });

      await act(async () => {
        await result.current.handleKycReview("reject");
      });

      expect(toast.error).toHaveBeenCalledWith("Rejection reason is required");
      expect(mockReviewKYC).not.toHaveBeenCalled();
    });
  });

  describe("handlePromote branches", () => {
    it("should return if no promoteTarget", async () => {
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handlePromote();
      });
      expect(mockPromoteToAdmin).not.toHaveBeenCalled();
    });
  });
});
