// app/src/pages/admin/context/AdminDashboardProvider.tsx
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import type { Id, Doc } from "convex/_generated/dataModel";
import { AdminDashboardContext, type KycReviewUser, type AdminProfile } from "./AdminDashboardContext";

export function AdminDashboardProvider({ children }: { children: React.ReactNode }) {
  // Queries
  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const adminStats = useQuery(api.admin.getAdminStats);
  
  const {
    results: allAuctions,
    status: auctionsStatus,
    loadMore: loadMoreAuctions,
  } = usePaginatedQuery(
    // @ts-expect-error - Convex types for usePaginatedQuery can be restrictive with custom queries
    api.auctions.getAllAuctions, 
    {}, 
    { initialNumItems: 50 }
  );
  
  const {
    results: allProfiles,
    status: profilesStatus,
    loadMore: loadMoreProfiles,
  } = usePaginatedQuery(
    // @ts-expect-error - listAllProfiles has specific filter args that usePaginatedQuery might struggle to infer perfectly
    api.users.listAllProfiles, 
    {}, 
    { initialNumItems: 50 }
  );

  // Mutations
  const approveAuctionMutation = useMutation(api.auctions.approveAuction);
  const rejectAuctionMutation = useMutation(api.auctions.rejectAuction);
  const bulkUpdateAuctionsMutation = useMutation(api.auctions.bulkUpdateAuctions);
  const verifyUserMutation = useMutation(api.users.verifyUser);
  const promoteToAdminMutation = useMutation(api.users.promoteToAdmin);
  const createAnnouncementMutation = useMutation(api.admin.createAnnouncement);
  const reviewKYCMutation = useMutation(api.admin.reviewKYC);
  const getProfileForKYCMutation = useMutation(api.users.getProfileForKYC);

  // State
  const [activeTab, setActiveTab] = useState("moderation");
  const [auctionSearch, setAuctionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedAuctions, setSelectedAuctions] = useState<Id<"auctions">[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<"active" | "rejected" | "sold" | "unsold" | null>(null);

  // KYC Review State
  const [kycReviewUser, setKycReviewUser] = useState<KycReviewUser | null>(null);
  const [isFetchingKYC, setIsFetchingKYC] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState("");
  const [showFullId, setShowFullId] = useState(false);

  // Promotion State
  const [promoteTarget, setPromoteTarget] = useState<AdminProfile | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  // Announcement State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  // Filtered data
  const filteredAuctions = useMemo(() => {
    if (!allAuctions) return [];
    return allAuctions.filter(
      (a) =>
        a.title.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.make.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.model.toLowerCase().includes(auctionSearch.toLowerCase()),
    );
  }, [allAuctions, auctionSearch]);

  const filteredUsers = useMemo(() => {
    if (!allProfiles) return [];
    return (allProfiles as AdminProfile[]).filter(
      (p) =>
        (p.name?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        (p.email?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        p.userId.toLowerCase().includes(userSearch.toLowerCase()),
    );
  }, [allProfiles, userSearch]);

  const stats = useMemo(() => {
    if (adminStats) return adminStats;
    if (!allAuctions || !allProfiles) return null;
    return {
      totalAuctions: allAuctions.length,
      activeAuctions: allAuctions.filter((a) => a.status === "active").length,
      pendingReview: allAuctions.filter((a) => a.status === "pending_review").length,
      totalUsers: allProfiles.length,
      verifiedSellers: allProfiles.filter((p) => (p as AdminProfile).isVerified).length,
    };
  }, [adminStats, allAuctions, allProfiles]);

  // Actions
  const handleReviewKYCClick = async (userId: string) => {
    setIsFetchingKYC(true);
    try {
      const fullProfile = await getProfileForKYCMutation({ userId });
      if (fullProfile && typeof fullProfile === "object" && "userId" in fullProfile) {
        setKycReviewUser(fullProfile as KycReviewUser);
        setShowFullId(false);
      } else {
        toast.error("Could not fetch profile details");
      }
    } catch (err) {
      console.error("KYC Fetch Error:", err);
      toast.error("Failed to load KYC details");
    } finally {
      setIsFetchingKYC(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedAuctions.length === 0 || !bulkStatusTarget) return;
    setIsBulkProcessing(true);
    try {
      await bulkUpdateAuctionsMutation({
        auctionIds: selectedAuctions,
        updates: { status: bulkStatusTarget },
      });
      toast.success(`Updated ${selectedAuctions.length} auctions to ${bulkStatusTarget}`);
      setSelectedAuctions([]);
      setBulkStatusTarget(null);
    } catch (err) {
      console.error("Bulk update failed:", err);
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleSendAnnouncement = async () => {
    const title = announcementTitle.trim();
    const message = announcementMessage.trim();
    if (!title || !message) {
      toast.error("Title and message cannot be empty");
      return;
    }
    try {
      await createAnnouncementMutation({ title, message });
      toast.success("Announcement sent");
      setAnnouncementOpen(false);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    } catch {
      toast.error("Failed to send");
    }
  };

  const handleKycReview = async (decision: "approve" | "reject") => {
    if (!kycReviewUser) return;

    const reason = kycRejectionReason.trim();
    if (decision === "reject" && !reason) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      await reviewKYCMutation({
        userId: kycReviewUser.userId,
        decision,
        reason: decision === "reject" ? reason : undefined,
      });
      toast.success(`KYC ${decision === "approve" ? "Approved" : "Rejected"}`);
      setKycReviewUser(null);
      setKycRejectionReason("");
      setShowFullId(false);
    } catch {
      toast.error("Review failed");
    }
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    setIsPromoting(true);
    try {
      await promoteToAdminMutation({ userId: promoteTarget.userId });
      toast.success("User promoted to Admin");
      setPromoteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setIsPromoting(false);
    }
  };

  const value = {
    pendingAuctions,
    allAuctions: allAuctions as Doc<"auctions">[] | undefined,
    allProfiles: allProfiles as AdminProfile[] | undefined,
    auctionsStatus,
    profilesStatus,
    stats,
    activeTab,
    setActiveTab,
    auctionSearch,
    setAuctionSearch,
    userSearch,
    setUserSearch,
    selectedAuctions,
    setSelectedAuctions,
    isBulkProcessing,
    bulkStatusTarget,
    setBulkStatusTarget,
    kycReviewUser,
    setKycReviewUser,
    isFetchingKYC,
    kycRejectionReason,
    setKycRejectionReason,
    showFullId,
    setShowFullId,
    promoteTarget,
    setPromoteTarget,
    isPromoting,
    announcementOpen,
    setAnnouncementOpen,
    announcementTitle,
    setAnnouncementTitle,
    announcementMessage,
    setAnnouncementMessage,
    filteredAuctions: filteredAuctions as Doc<"auctions">[],
    filteredUsers,
    loadMoreAuctions,
    loadMoreProfiles,
    approveAuction: async (auctionId: Id<"auctions">) => { await approveAuctionMutation({ auctionId }); },
    rejectAuction: async (auctionId: Id<"auctions">) => { await rejectAuctionMutation({ auctionId }); },
    bulkUpdateAuctions: async (args: { auctionIds: Id<"auctions">[]; updates: { status: "active" | "rejected" | "sold" | "unsold" } }) => { 
      await bulkUpdateAuctionsMutation(args); 
    },
    verifyUser: async (userId: string) => { await verifyUserMutation({ userId }); },
    promoteToAdmin: async (userId: string) => { await promoteToAdminMutation({ userId }); },
    handleReviewKYCClick,
    handleKycReview,
    handleBulkStatusUpdate,
    handleSendAnnouncement,
    handlePromote,
  };

  return (
    <AdminDashboardContext.Provider value={value}>
      {children}
    </AdminDashboardContext.Provider>
  );
}
