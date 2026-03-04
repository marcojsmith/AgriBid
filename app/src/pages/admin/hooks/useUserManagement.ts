import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

/**
 * KYC review user data interface
 */
export interface KycReviewUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  phoneNumber?: string;
  kycEmail?: string;
  kycDocumentIds?: string[];
  kycDocumentUrls?: string[];
}

/**
 * Admin profile interface for promotion target
 */
export interface AdminProfile {
  _id: Id<"profiles">;
  userId: string;
  name?: string;
  email?: string;
  role: string;
  isVerified?: boolean;
  kycStatus?: string;
  createdAt: number;
}

/**
 * Manage user administration state and handlers for KYC review, verification and promotion.
 *
 * Encapsulates search/filter state, KYC review dialog state and actions, promotion dialog state and actions,
 * and per-user verification tracking for consumption by admin UI components.
 *
 * @returns An object exposing:
 * - Search state: `userSearch`, `setUserSearch`
 * - KYC review: `kycReviewUser`, `setKycReviewUser`, `isFetchingKYC`, `fetchingKycUserId`, `isKycProcessing`,
 *   `kycRejectionReason`, `setKycRejectionReason`, `showFullId`, `setShowFullId`, `handleReviewKYCClick`,
 *   `handleKycReview`, `closeKycReview`
 * - Promotion: `promoteTarget`, `setPromoteTarget`, `isPromoting`, `handlePromote`, `closePromotion`
 * - Verification: `verifyingUserIds`, `handleManualVerify`
 */
export function useUserManagement() {
  // Mutations
  const verifyUserMutation = useMutation(api.users.verifyUser);
  const promoteToAdminMutation = useMutation(api.users.promoteToAdmin);
  const reviewKYCMutation = useMutation(api.admin.reviewKYC);
  const getProfileForKYCMutation = useMutation(api.users.getProfileForKYC);

  // Search and filter state
  const [userSearch, setUserSearch] = useState("");

  // KYC review dialog state
  const [kycReviewUser, setKycReviewUser] = useState<KycReviewUser | null>(
    null
  );
  const [isFetchingKYC, setIsFetchingKYC] = useState(false);
  const [fetchingKycUserId, setFetchingKycUserId] = useState<string | null>(
    null
  );
  const [isKycProcessing, setIsKycProcessing] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState("");
  const [showFullId, setShowFullId] = useState(false);

  // Promotion dialog state
  const [promoteTarget, setPromoteTarget] = useState<AdminProfile | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Verification state tracking (Set for tracking which users are being verified)
  const [verifyingUserIds, setVerifyingUserIds] = useState<Set<string>>(
    new Set()
  );

  /**
   * Type guard to ensure profile has all required fields for KYC review.
   * @param obj - The object to check
   * @returns True if the object is a KycReviewUser, false otherwise.
   */
  const isKycReviewUser = (obj: unknown): obj is KycReviewUser => {
    if (obj === null || typeof obj !== "object") return false;
    const candidate = obj as Record<string, unknown>;
    return (
      typeof candidate.userId === "string" &&
      Array.isArray(candidate.kycDocumentIds) &&
      Array.isArray(candidate.kycDocumentUrls)
    );
  };

  /**
   * Initiates KYC review by fetching full user profile data.
   * Shows loading state and error handling via toast notifications.
   * @param userId
   */
  const handleReviewKYCClick = async (userId: string) => {
    if (isFetchingKYC) return;
    setIsFetchingKYC(true);
    setFetchingKycUserId(userId);
    try {
      const fullProfile = await getProfileForKYCMutation({ userId });
      // Verify we are still looking for this specific user to avoid race conditions
      if (
        fullProfile &&
        isKycReviewUser(fullProfile) &&
        fullProfile.userId === userId
      ) {
        setKycReviewUser(fullProfile);
        setShowFullId(false);
        setKycRejectionReason("");
      } else if (
        fullProfile &&
        "userId" in fullProfile &&
        fullProfile.userId !== userId
      ) {
        // Stale response, ignore
        return;
      } else {
        toast.error("Could not fetch profile details");
      }
    } catch (err) {
      console.error("KYC Fetch Error:", err);
      toast.error("Failed to load KYC details");
    } finally {
      setIsFetchingKYC(false);
      setFetchingKycUserId(null);
    }
  };

  /**
   * Manually verifies a user without KYC review.
   * Tracks verification state per user to prevent duplicate requests.
   * @param userId
   */
  const handleManualVerify = async (userId: string) => {
    let added = false;
    setVerifyingUserIds((prev) => {
      if (prev.has(userId)) return prev;
      added = true;
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    if (!added) return; // If not added, it means it was already being verified

    try {
      await verifyUserMutation({ userId });
      toast.success("User verified");
    } catch (err) {
      console.error(err);
      toast.error("Verification failed");
    } finally {
      setVerifyingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  /**
   * Submits KYC approval or rejection decision.
   * Validates rejection reason is provided when rejecting.
   * @param decision
   */
  const handleKycReview = async (decision: "approve" | "reject") => {
    if (!kycReviewUser) return;
    const reason = kycRejectionReason.trim();
    if (decision === "reject" && !reason) {
      toast.error("Rejection reason is required");
      return;
    }
    setIsKycProcessing(true);
    try {
      await reviewKYCMutation({
        userId: kycReviewUser.userId,
        decision,
        reason: decision === "reject" ? reason : undefined,
      });
      toast.success(`KYC ${decision === "approve" ? "Approved" : "Rejected"}`);
      setKycReviewUser(null);
      setKycRejectionReason("");
    } catch (err) {
      console.error(err);
      toast.error("Review failed");
    } finally {
      setIsKycProcessing(false);
    }
  };

  /**
   * Promotes a user to admin role.
   * Closes the promotion dialog on success.
   */
  const handlePromote = async () => {
    if (!promoteTarget) return;
    setIsPromoting(true);
    try {
      await promoteToAdminMutation({ userId: promoteTarget.userId });
      toast.success("User promoted to Admin");
      setPromoteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Promotion failed");
    } finally {
      setIsPromoting(false);
    }
  };

  /**
   * Closes KYC review dialog and resets related state
   */
  const closeKycReview = () => {
    setKycReviewUser(null);
    setKycRejectionReason("");
    setShowFullId(false);
  };

  /**
   * Closes promotion dialog
   */
  const closePromotion = () => {
    setPromoteTarget(null);
  };

  return {
    // Search state
    userSearch,
    setUserSearch,

    // KYC review state and handlers
    kycReviewUser,
    setKycReviewUser,
    isFetchingKYC,
    fetchingKycUserId,
    isKycProcessing,
    kycRejectionReason,
    setKycRejectionReason,
    showFullId,
    setShowFullId,
    handleReviewKYCClick,
    handleKycReview,
    closeKycReview,

    // Promotion state and handlers
    promoteTarget,
    setPromoteTarget,
    isPromoting,
    handlePromote,
    closePromotion,

    // Verification state and handlers
    verifyingUserIds,
    handleManualVerify,
  };
}
