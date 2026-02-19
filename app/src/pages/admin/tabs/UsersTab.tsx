// app/src/pages/admin/tabs/UsersTab.tsx
import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, ArrowRight, Users } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { useAdminDashboard } from "../context/useAdminDashboard";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/**
 * Render the Users administration tab with a table of user profiles and controls for KYC review, verification, promotion, and pagination.
 *
 * Displays an empty state when no users are present, shows per-user identity, role, verification and KYC status, join date, and context-sensitive action buttons (Review KYC, Verify, Promote, navigate). When available, shows a "Load More Users" control.
 *
 * @returns A JSX element representing the Users tab UI.
 */
export function UsersTab() {
  const {
    filteredUsers,
    isFetchingKYC,
    fetchingKycUserId,
    handleReviewKYCClick,
    verifyUser,
    setPromoteTarget,
    profilesStatus,
    loadMoreProfiles,
  } = useAdminDashboard();

  const [verifyingUserIds, setVerifyingUserIds] = useState<Set<string>>(new Set());

  const handleManualVerify = async (userId: string) => {
    if (verifyingUserIds.has(userId)) return;

    setVerifyingUserIds((prev) => new Set(prev).add(userId));
    try {
      await verifyUser(userId);
      toast.success("User verified");
    } catch (err) {
      console.error(`Failed to verify user ${userId}:`, err);
      toast.error(`Verification failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setVerifyingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <TabsContent
      value="users"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
    >
      <Card className="border-2 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-b-2">
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Identity
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Role / Perms
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Verified
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Joined
              </TableHead>
              <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Users className="h-8 w-8 opacity-20" />
                    <p className="font-bold uppercase text-xs tracking-widest">No users found</p>
                    <p className="text-[10px] font-medium">Try adjusting your search criteria</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((p) => (
                <TableRow key={p._id} className="hover:bg-muted/20 border-b">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs border-2 border-primary/20 uppercase">
                        {p.name?.[0] || "?"}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm">{p.name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {p.email || "No email"}
                        </p>
                        <p className="text-[9px] font-mono opacity-50 uppercase">
                          {p.userId}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.role === "admin" ? "default" : "outline"}
                      className="font-black uppercase text-[10px] tracking-widest px-2.5"
                    >
                      {p.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
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
                        <Badge
                          className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[9px] uppercase"
                        >
                          {isFetchingKYC && fetchingKycUserId === p.userId ? (
                            <LoadingIndicator size="sm" />
                          ) : (
                            "KYC Pending"
                          )}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-bold text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      {p.kycStatus === "pending" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 font-black uppercase text-[10px] tracking-wider bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                          onClick={() => handleReviewKYCClick(p.userId)}
                          disabled={isFetchingKYC}
                        >
                          {isFetchingKYC && fetchingKycUserId === p.userId ? (
                            <LoadingIndicator size="sm" className="mr-2" />
                          ) : null}
                          Review KYC
                        </Button>
                      )}
                      {!p.isVerified && p.kycStatus !== "pending" && (
                        <div className="flex flex-col items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-2 font-black uppercase text-[10px] tracking-wider"
                            onClick={() => handleManualVerify(p.userId)}
                            disabled={verifyingUserIds.has(p.userId)}
                          >
                            {verifyingUserIds.has(p.userId) ? (
                                <LoadingIndicator size="sm" className="mr-2" />
                            ) : null}
                            Verify
                          </Button>
                          <span className="text-[8px] text-muted-foreground uppercase font-black mt-1 opacity-50">
                            KYC Override
                          </span>
                        </div>
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
                        aria-label={`View details for ${p.name || p.email || 'user'}`}
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
    </TabsContent>
  );
}