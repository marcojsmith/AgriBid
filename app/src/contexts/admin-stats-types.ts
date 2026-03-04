import { createContext } from "react";

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

export const NO_PROVIDER = Symbol("NO_PROVIDER");

export const AdminStatsContext = createContext<AdminStats | undefined | null>(
  NO_PROVIDER as unknown as AdminStats | undefined | null
);
