// app/src/pages/admin/context/AdminDashboardContext.ts
import { createContext } from "react";
import type { Id, Doc } from "convex/_generated/dataModel";

/**
 * Shared profile fields returned by aggregate queries or joined data.
 */
export type BaseProfileFields = {
  name?: string;
  email?: string;
  image?: string;
};

export type KycReviewUser = Doc<"profiles"> & BaseProfileFields & {
  kycDocuments?: string[];
};

export interface AdminProfile extends Doc<"profiles">, BaseProfileFields {}

export interface AdminDashboardContextType {
  // Data
  pendingAuctions: Doc<"auctions">[] | undefined;
  allAuctions: Doc<"auctions">[] | undefined;
  allProfiles: AdminProfile[] | undefined;
  auctionsStatus: "CanLoadMore" | "LoadingMore" | "Exhausted" | "LoadingFirstPage";
  profilesStatus: "CanLoadMore" | "LoadingMore" | "Exhausted" | "LoadingFirstPage";
  stats: {
    totalAuctions: number;
    activeAuctions: number;
    pendingReview: number;
    totalUsers: number;
    verifiedSellers: number;
  } | null;

  // State
  activeTab: string;
  setActiveTab: (tab: string) => void;
  auctionSearch: string;
  setAuctionSearch: (search: string) => void;
  userSearch: string;
  setUserSearch: (search: string) => void;
  selectedAuctions: Id<"auctions">[];
  setSelectedAuctions: React.Dispatch<React.SetStateAction<Id<"auctions">[]>>;
  isBulkProcessing: boolean;
  bulkStatusTarget: "active" | "rejected" | "sold" | "unsold" | null;
  setBulkStatusTarget: (target: "active" | "rejected" | "sold" | "unsold" | null) => void;

  // KYC Review State
  kycReviewUser: KycReviewUser | null;
  setKycReviewUser: (user: KycReviewUser | null) => void;
  isFetchingKYC: boolean;
  kycRejectionReason: string;
  setKycRejectionReason: (reason: string) => void;
  showFullId: boolean;
  setShowFullId: (show: boolean) => void;

  // Promotion State
  promoteTarget: AdminProfile | null;
  setPromoteTarget: (user: AdminProfile | null) => void;
  isPromoting: boolean;

  // Announcement State
  announcementOpen: boolean;
  setAnnouncementOpen: (open: boolean) => void;
  announcementTitle: string;
  setAnnouncementTitle: (title: string) => void;
  announcementMessage: string;
  setAnnouncementMessage: (message: string) => void;

  // Filtered Data
  filteredAuctions: Doc<"auctions">[];
  filteredUsers: AdminProfile[];

  // Actions
  loadMoreAuctions: (num: number) => void;
  loadMoreProfiles: (num: number) => void;
  approveAuction: (id: Id<"auctions">) => Promise<void>;
  rejectAuction: (id: Id<"auctions">) => Promise<void>;
  bulkUpdateAuctions: (args: { auctionIds: Id<"auctions">[]; updates: { status: "active" | "rejected" | "sold" | "unsold" } }) => Promise<void>;
  verifyUser: (userId: string) => Promise<void>;
  promoteToAdmin: (userId: string) => Promise<void>;
  handleReviewKYCClick: (userId: string) => Promise<void>;
  handleKycReview: (decision: "approve" | "reject") => Promise<void>;
  handleBulkStatusUpdate: () => Promise<void>;
  handleSendAnnouncement: () => Promise<void>;
  handlePromote: () => Promise<void>;
}

export const AdminDashboardContext = createContext<AdminDashboardContextType | undefined>(undefined);
