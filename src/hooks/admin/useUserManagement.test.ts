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
      registration: {
        getRegistrationForReview: "reg:getForReview",
        reviewDocument: "reg:reviewDocument",
      },
    },
  },
}));

describe("useUserManagement hook", () => {
  const mockVerifyUser = vi.fn();
  const mockPromoteToAdmin = vi.fn();
  const mockReviewKYC = vi.fn();
  const mockGetProfileForKYC = vi.fn();
  const mockGetRegistration = vi.fn();
  const mockReviewDocument = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === "users:verifyUser") return mockVerifyUser;
      if (apiPath === "users:promoteToAdmin") return mockPromoteToAdmin;
      if (apiPath === "admin:reviewKYC") return mockReviewKYC;
      if (apiPath === "users:getProfileForKYC") return mockGetProfileForKYC;
      if (apiPath === "reg:getForReview") return mockGetRegistration;
      if (apiPath === "reg:reviewDocument") return mockReviewDocument;
      return vi.fn();
    });
  });

  describe("per-document registration review", () => {
    const registration = {
      details: { idType: "sa_id" as const, fullName: "Thandi Nkosi" },
      documents: [
        {
          id: "d1",
          kind: "id_front" as const,
          status: "pending" as const,
          fileName: "front.jpg",
          fileSize: 10,
          uploadedAt: 1,
        },
      ],
      deposit: null,
      legacy: false,
    };

    it("opens the registration review and skips the legacy profile", async () => {
      mockGetRegistration.mockResolvedValue(registration);
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(result.current.registrationReview).toEqual(registration);
      expect(result.current.kycReviewUser?.userId).toBe("u1");
      expect(mockGetProfileForKYC).not.toHaveBeenCalled();
    });

    it("falls back to the legacy profile for a legacy registration", async () => {
      mockGetRegistration.mockResolvedValue({ ...registration, legacy: true });
      mockGetProfileForKYC.mockResolvedValue({
        userId: "u1",
        kycDocumentCount: 1,
      });
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(result.current.registrationReview).toBeNull();
      expect(result.current.kycReviewUser?.kycDocumentCount).toBe(1);
    });

    it("records an approval locally and closes cleanly", async () => {
      mockGetRegistration.mockResolvedValue(registration);
      mockReviewDocument.mockResolvedValue({
        success: true,
        kycStatus: "pending",
      });
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      let saved = false;
      await act(async () => {
        saved = await result.current.handleReviewDocument(
          registration.documents[0] as never,
          "approve"
        );
      });
      expect(saved).toBe(true);
      expect(mockReviewDocument).toHaveBeenCalledWith({
        documentId: "d1",
        expectedUploadedAt: 1,
        decision: "approve",
        reason: undefined,
      });
      expect(result.current.registrationReview?.documents[0]).toMatchObject({
        status: "approved",
      });
      expect(toast.success).toHaveBeenCalledWith("Document approved");
      act(() => {
        result.current.closeKycReview();
      });
      expect(result.current.registrationReview).toBeNull();
    });

    it("sends a trimmed reason with a rejection and keeps it on the document", async () => {
      mockGetRegistration.mockResolvedValue(registration);
      mockReviewDocument.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      await act(async () => {
        await result.current.handleReviewDocument(
          registration.documents[0] as never,
          "reject",
          " Blurry "
        );
      });
      expect(mockReviewDocument).toHaveBeenCalledWith({
        documentId: "d1",
        expectedUploadedAt: 1,
        decision: "reject",
        reason: "Blurry",
      });
      expect(result.current.registrationReview?.documents[0]).toMatchObject({
        status: "rejected",
        rejectionReason: "Blurry",
      });
      expect(toast.success).toHaveBeenCalledWith("Document rejected");
    });

    it("shows the server message and leaves the document alone on failure", async () => {
      mockGetRegistration.mockResolvedValue(registration);
      mockReviewDocument.mockRejectedValue(new Error("Document not found."));
      const { result } = renderHook(() => useUserManagement());
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      let saved = true;
      await act(async () => {
        saved = await result.current.handleReviewDocument(
          registration.documents[0] as never,
          "approve"
        );
      });
      expect(saved).toBe(false);
      expect(toast.error).toHaveBeenCalledWith("Document not found.");
      expect(result.current.registrationReview?.documents[0]?.status).toBe(
        "pending"
      );
    });

    it("does nothing without an open registration", async () => {
      const { result } = renderHook(() => useUserManagement());
      let saved = true;
      await act(async () => {
        saved = await result.current.handleReviewDocument(
          registration.documents[0] as never,
          "approve"
        );
      });
      expect(saved).toBe(false);
      expect(mockReviewDocument).not.toHaveBeenCalled();
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

      mockGetProfileForKYC.mockResolvedValue({ userId: 123 });
      await act(async () => {
        await result.current.handleReviewKYCClick("u1");
      });
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch profile details"
      );

      mockGetProfileForKYC.mockResolvedValue({
        userId: "u1",
        kycDocumentCount: "not a number",
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

      expect(mockGetProfileForKYC).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveMutation({
          userId: "u1",
          kycDocumentCount: 0,
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
        resolveVerify(undefined);
        await p1;
      });
    });

    it("should block duplicate invocation when called twice in immediate succession", () => {
      const { result } = renderHook(() => useUserManagement());

      mockVerifyUser.mockResolvedValue(undefined);

      act(() => {
        void result.current.handleManualVerify("u1");
      });
      act(() => {
        void result.current.handleManualVerify("u1");
      });

      expect(mockVerifyUser).toHaveBeenCalledTimes(1);
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
          kycDocumentCount: 0,
        });
        result.current.setKycRejectionReason("   ");
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
