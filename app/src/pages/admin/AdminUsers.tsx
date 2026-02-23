import { useMemo } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
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
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { KycReviewDialog, PromoteAdminDialog } from "./dialogs";
import { useUserManagement, type AdminProfile } from "./hooks";

/**
 * Render the Admin Users page with search, paginated user list, status indicators and actions for KYC review, manual verification and promotion.
 *
 * @returns The Admin Users page JSX element
 */
export default function AdminUsers() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const {
    results: allProfiles,
    status: profilesStatus,
    loadMore: loadMoreProfiles,
  } = usePaginatedQuery(api.users.listAllProfiles, {}, { initialNumItems: 50 });

  // Use custom hook for all user management state and handlers
  const {
    userSearch,
    setUserSearch,
    kycReviewUser,
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
    promoteTarget,
    setPromoteTarget,
    isPromoting,
    handlePromote,
    closePromotion,
    verifyingUserIds,
    handleManualVerify,
  } = useUserManagement();

  const filteredUsers = useMemo(() => {
    if (!allProfiles) return [];
    return (allProfiles as AdminProfile[]).filter(
      (p) =>
        (p.name?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        (p.email?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        p.userId.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [allProfiles, userSearch]);

  if (allProfiles === undefined || adminStats === undefined) {
    return (
      <AdminLayout
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
        onClose={closeKycReview}
        onReview={handleKycReview}
        isProcessing={isKycProcessing}
        rejectionReason={kycRejectionReason}
        setRejectionReason={setKycRejectionReason}
        showFullId={showFullId}
        setShowFullId={setShowFullId}
      />
      <PromoteAdminDialog
        isOpen={!!promoteTarget}
        onClose={closePromotion}
        onConfirm={handlePromote}
        isProcessing={isPromoting}
        targetUser={promoteTarget}
      />
    </AdminLayout>
  );
}
