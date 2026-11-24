import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "convex/_generated/dataModel";

import type { SellerType } from "@/lib/lotSpecs";
import type { SellerResponseTime } from "@/lib/provinces";
import { getErrorMessage } from "@/lib/utils";

/**
 * A buyer's registration as the admin review sees it: decrypted details,
 * document metadata (never a URL) and the deposit.
 */
export type RegistrationReview = NonNullable<
  FunctionReturnType<typeof api.admin.registration.getRegistrationForReview>
>;

/** A document in a {@link RegistrationReview}. */
export type ReviewDocument = RegistrationReview["documents"][number];

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
  /** How many legacy KYC files the user has (read via `/documents/file`). */
  kycDocumentCount?: number;
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
  /** Admin-set seller reply time, if any. */
  sellerResponseTime?: SellerResponseTime;
  /** Whether the seller is VAT registered. */
  vatRegistered?: boolean;
  /** Seller type, if set. */
  sellerType?: SellerType;
  createdAt: number;
  isOnline?: boolean;
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
  const getRegistrationMutation = useMutation(
    api.admin.registration.getRegistrationForReview
  );
  const reviewDocumentMutation = useMutation(
    api.admin.registration.reviewDocument
  );

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
  // Set instead of the legacy profile when the buyer registered with documents.
  const [registrationReview, setRegistrationReview] =
    useState<RegistrationReview | null>(null);
  const [isReviewingDocument, setIsReviewingDocument] = useState(false);

  // Promotion dialog state
  const [promoteTarget, setPromoteTarget] = useState<AdminProfile | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Verification state tracking (Set for tracking which users are being verified)
  const [verifyingUserIds, setVerifyingUserIds] = useState<Set<string>>(
    new Set()
  );
  const verifyingUserIdsRef = useRef(new Set<string>());

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
      typeof candidate.kycDocumentCount === "number"
    );
  };

  /**
   * Initiates KYC review by fetching full user profile data.
   * Shows loading state and error handling via toast notifications.
   * @param userId - The user ID to review KYC for
   */
  const handleReviewKYCClick = async (userId: string) => {
    if (isFetchingKYC) return;
    setIsFetchingKYC(true);
    setFetchingKycUserId(userId);
    try {
      // Registration first: a buyer with per-document registration is reviewed
      // document by document; legacy submissions fall through to the old view.
      const registration = await getRegistrationMutation({ userId });
      if (registration && !registration.legacy) {
        setRegistrationReview(registration);
        setKycReviewUser({ userId, kycDocumentCount: 0 });
        setShowFullId(false);
        setKycRejectionReason("");
        return;
      }
      setRegistrationReview(null);
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
        typeof fullProfile === "object" &&
        "userId" in fullProfile &&
        typeof fullProfile.userId === "string" &&
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
   * @param userId - The ID of the user to verify
   */
  const handleManualVerify = async (userId: string) => {
    if (verifyingUserIdsRef.current.has(userId)) return;
    verifyingUserIdsRef.current.add(userId);

    setVerifyingUserIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    try {
      await verifyUserMutation({ userId });
      toast.success("User verified");
    } catch (err) {
      console.error(err);
      toast.error("Verification failed");
    } finally {
      verifyingUserIdsRef.current.delete(userId);
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
   * @param decision - Decision type: 'approve' or 'reject'
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
   * Approves or rejects one registration document and mirrors the result in the
   * open review (the review is a one-off audited read, so it is updated locally).
   * @param doc - The document to review, as shown in the open review
   * @param decision - "approve" or "reject"
   * @param reason - Required for a rejection
   * @returns True when the decision was saved
   */
  const handleReviewDocument = async (
    doc: ReviewDocument,
    decision: "approve" | "reject",
    reason?: string
  ): Promise<boolean> => {
    if (!registrationReview || isReviewingDocument) return false;
    setIsReviewingDocument(true);
    try {
      await reviewDocumentMutation({
        documentId: doc.id,
        expectedUploadedAt: doc.uploadedAt,
        decision,
        reason: decision === "reject" ? reason?.trim() : undefined,
      });
      const reviewedAt = Date.now();
      setRegistrationReview((current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((item) =>
                item.id === doc.id
                  ? {
                      ...item,
                      status: decision === "approve" ? "approved" : "rejected",
                      rejectionReason:
                        decision === "reject" ? reason?.trim() : undefined,
                      reviewedAt,
                    }
                  : item
              ),
            }
          : current
      );
      toast.success(
        decision === "approve" ? "Document approved" : "Document rejected"
      );
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, "Review failed"));
      return false;
    } finally {
      setIsReviewingDocument(false);
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
    setRegistrationReview(null);
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
    registrationReview,
    isReviewingDocument,
    handleReviewDocument,

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
