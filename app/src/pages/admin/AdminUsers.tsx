import { useState, useMemo } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, ArrowRight, Search } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { KycReviewDialog, PromoteAdminDialog } from "./AdminDialogs";
import type { Id } from "convex/_generated/dataModel";

interface KycReviewUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  phoneNumber?: string;
  kycEmail?: string;
  kycDocuments?: string[];
}

interface AdminProfile {
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
 * Admin page component that provides a user management interface with search, KYC review, manual verification and promotion-to-admin actions.
 *
 * Renders a paginated list of user profiles, per-user action buttons (Review KYC, Verify, Promote), and the related KYC review and promote dialogs.
 *
 * @returns The React element for the Admin Users interface.
 */
export default function AdminUsers() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const [userSearch, setUserSearch] = useState("");

  const {
    results: allProfiles,
    status: profilesStatus,
    loadMore: loadMoreProfiles,
  } = usePaginatedQuery(api.users.listAllProfiles, {}, { initialNumItems: 50 });

  // Mutations
  const verifyUserMutation = useMutation(api.users.verifyUser);
  const promoteToAdminMutation = useMutation(api.users.promoteToAdmin);
  const reviewKYCMutation = useMutation(api.admin.reviewKYC);
  const getProfileForKYCMutation = useMutation(api.users.getProfileForKYC);

  // Local UI State
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
  const [promoteTarget, setPromoteTarget] = useState<AdminProfile | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [verifyingUserIds, setVerifyingUserIds] = useState<Set<string>>(
    new Set()
  );

  const filteredUsers = useMemo(() => {
    if (!allProfiles) return [];
    return (allProfiles as AdminProfile[]).filter(
      (p) =>
        (p.name?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        (p.email?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        p.userId.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [allProfiles, userSearch]);

  const handleReviewKYCClick = async (userId: string) => {
    setIsFetchingKYC(true);
    setFetchingKycUserId(userId);
    try {
      const fullProfile = await getProfileForKYCMutation({ userId });
      if (
        fullProfile &&
        typeof fullProfile === "object" &&
        "userId" in fullProfile
      ) {
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
      setFetchingKycUserId(null);
    }
  };

  const handleManualVerify = async (userId: string) => {
    if (verifyingUserIds.has(userId)) return;
    setVerifyingUserIds((prev) => new Set(prev).add(userId));
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

  if (allProfiles === undefined || adminStats === undefined) {
    return (
      <AdminLayout
        stats={adminStats || null}
        title="User Management"
        subtitle="Oversight of Platform Participants & Verification"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      stats={adminStats}
      title="User Management"
      subtitle="Oversight of Platform Participants & Verification"
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20 p-4 rounded-xl border-2 border-dashed">
          <div className="relative group w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search Users..."
              className="pl-9 h-9 border-2 rounded-lg bg-background focus-visible:ring-primary/20"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="font-bold">
            {allProfiles.length} Total Profiles
          </Badge>
        </div>
        <Card className="border-2 overflow-hidden bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Identity
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Role
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Verification
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Joined
                </TableHead>
                <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground italic font-medium"
                  >
                    No users found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((p) => (
                  <TableRow
                    key={p._id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs border-2 border-primary/20">
                          {p.name?.[0] || "?"}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">
                            {p.name || "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {p.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.role === "admin" ? "default" : "outline"}
                        className="font-black uppercase text-[10px] tracking-widest"
                      >
                        {p.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {p.isVerified ? (
                          <div className="flex items-center gap-1.5 text-green-600 font-bold text-xs">
                            <ShieldCheck className="h-4 w-4" /> Verified
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-xs opacity-50">
                            <AlertCircle className="h-4 w-4" /> Unverified
                          </div>
                        )}
                        {p.kycStatus === "pending" && (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[9px] uppercase w-fit">
                            KYC Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        {p.kycStatus === "pending" && (
                          <Button
                            size="sm"
                            className="h-8 font-black uppercase text-[10px] tracking-wider bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                            onClick={() => handleReviewKYCClick(p.userId)}
                            disabled={
                              isFetchingKYC && fetchingKycUserId === p.userId
                            }
                          >
                            {isFetchingKYC && fetchingKycUserId === p.userId ? (
                              <LoadingIndicator size="sm" className="mr-2" />
                            ) : (
                              "Review KYC"
                            )}
                          </Button>
                        )}
                        {!p.isVerified && p.kycStatus !== "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-2 font-black uppercase text-[10px] tracking-wider"
                            onClick={() => handleManualVerify(p.userId)}
                            disabled={verifyingUserIds.has(p.userId)}
                          >
                            Verify
                          </Button>
                        )}
                        {p.role !== "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-2 font-black uppercase text-[10px] tracking-wider"
                            onClick={() => setPromoteTarget(p)}
                          >
                            Promote
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <Link to={`/profile/${p.userId}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {profilesStatus === "CanLoadMore" && (
            <div className="p-4 border-t bg-muted/20 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadMoreProfiles(50)}
                className="font-bold uppercase text-[10px] tracking-widest border-2"
              >
                Load More Users
              </Button>
            </div>
          )}
        </Card>
      </div>
      <KycReviewDialog
        user={kycReviewUser}
        isOpen={!!kycReviewUser}
        onClose={() => setKycReviewUser(null)}
        onReview={handleKycReview}
        isProcessing={isKycProcessing}
        rejectionReason={kycRejectionReason}
        setRejectionReason={setKycRejectionReason}
        showFullId={showFullId}
        setShowFullId={setShowFullId}
      />
      <PromoteAdminDialog
        isOpen={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onConfirm={handlePromote}
        isProcessing={isPromoting}
        targetUser={promoteTarget}
      />
    </AdminLayout>
  );
}