import { createTypedContext } from "../contexts/createTypedContext";

export interface AdminStats {
  totalAuctions: number;
  activeAuctions: number;
  pendingReview: number;
  totalUsers: number;
  verifiedSellers: number;
  kycPending: number;
  status: "partial" | "healthy";
  liveUsers: number;
  activeWatch: number;
}

export const [AdminStatsContext, useAdminStats] =
  createTypedContext<AdminStats>("AdminStats");
