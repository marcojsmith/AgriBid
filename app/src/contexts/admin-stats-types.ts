import { createContext } from "react";

export interface AdminStats {
  totalAuctions: number;
  activeAuctions: number;
  pendingReview: number;
  totalUsers: number;
  verifiedSellers: number;
}

export const AdminStatsContext = createContext<AdminStats | undefined | null>(
  undefined
);
