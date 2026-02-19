// app/src/pages/AdminDashboard.tsx
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  X,
  Eye,
  Clock,
  Hammer,
  Users,
  ShieldCheck,
  Gavel,
  Settings,
  Search,
  Filter,
  MoreVertical,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  DollarSign,
  FileText,
  Megaphone,
  Fingerprint,
  Phone,
  Mail,
  UserCheck,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import type { Id, Doc } from "convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import Sub-Tabs
import { FinanceTab } from "@/components/admin/FinanceTab";
import { SupportTab } from "@/components/admin/SupportTab";
import { AuditTab } from "@/components/admin/AuditTab";
import { BidMonitor } from "@/components/admin/BidMonitor";

interface AuctionImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

function normalizeAuctionImages(
  images: AuctionImages | string[] | undefined,
): AuctionImages {
  if (!images) return { additional: [] };
  if (Array.isArray(images)) {
    return {
      front: images[0],
      additional: images.slice(1),
    };
  }
  return images;
}

type KycReviewUser = Doc<"profiles"> & {
  name?: string;
  email?: string;
  image?: string;
  kycDocuments?: string[]; // Now typed as URL strings
};

/**
 * Render the Admin Dashboard interface for managing auctions, users, finance, support, audit, and system settings.
 *
 * Displays tabbed views for Moderation, Marketplace, Users, Finance, Support, Audit, and Settings; fetches auction and user data and exposes administrative actions such as approving/rejecting auctions, bulk status updates, user verification and promotion, KYC review with document viewing, and sending broadcast announcements.
 *
 * @returns The Admin Dashboard React element
 */
export default function AdminDashboard() {
  const navigate = useNavigate();

  // Queries
  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const {
    results: allAuctions,
    status: auctionsStatus,
    loadMore: loadMoreAuctions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = usePaginatedQuery(api.auctions.getAllAuctions as any, {}, { initialNumItems: 50 });
  const {
    results: allProfiles,
    status: profilesStatus,
    loadMore: loadMoreProfiles,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = usePaginatedQuery(api.users.listAllProfiles as any, {}, { initialNumItems: 50 });

  // Mutations
  const approveAuction = useMutation(api.auctions.approveAuction);
  const rejectAuction = useMutation(api.auctions.rejectAuction);
  const bulkUpdateAuctions = useMutation(api.auctions.bulkUpdateAuctions);
  const verifyUser = useMutation(api.users.verifyUser);
  const promoteToAdmin = useMutation(api.users.promoteToAdmin);
  const createAnnouncement = useMutation(api.admin.createAnnouncement);
  const reviewKYC = useMutation(api.admin.reviewKYC);
  const getProfileForKYC = useMutation(api.users.getProfileForKYC);

  // State
  const [activeTab, setActiveTab] = useState("moderation");
  const [auctionSearch, setAuctionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedAuctions, setSelectedAuctions] = useState<Id<"auctions">[]>(
    [],
  );
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<
    "active" | "rejected" | "sold" | "unsold" | null
  >(null);

  // KYC Review State
  const [kycReviewUser, setKycReviewUser] = useState<KycReviewUser | null>(
    null,
  );
  const [isFetchingKYC, setIsFetchingKYC] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState("");
  const [showFullId, setShowFullId] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState<KycReviewUser | null>(
    null,
  );
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
    return allProfiles.filter(
      (p) =>
        (p.name?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        (p.email?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        p.userId.toLowerCase().includes(userSearch.toLowerCase()) ||
        (p.firstName?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
        (p.lastName?.toLowerCase() || "").includes(userSearch.toLowerCase()),
    );
  }, [allProfiles, userSearch]);

  const stats = useMemo(() => {
    if (!allAuctions || !allProfiles) return null;
    return {
      totalAuctions: allAuctions.length,
      activeAuctions: allAuctions.filter((a) => a.status === "active").length,
      pendingReview: allAuctions.filter((a) => a.status === "pending_review")
        .length,
      totalUsers: allProfiles.length,
      verifiedSellers: allProfiles.filter((p) => p.isVerified).length,
    };
  }, [allAuctions, allProfiles]);

  if (
    pendingAuctions === undefined ||
    allAuctions === undefined ||
    allProfiles === undefined
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <LoadingIndicator />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
          Initializing Terminal...
        </p>
      </div>
    );
  }

  const handleReviewKYCClick = async (userId: string) => {
    setIsFetchingKYC(true);
    try {
      const fullProfile = await getProfileForKYC({ userId });
      if (fullProfile) {
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
      await bulkUpdateAuctions({
        auctionIds: selectedAuctions,
        updates: { status: bulkStatusTarget },
      });
      toast.success(
        `Updated ${selectedAuctions.length} auctions to ${bulkStatusTarget}`,
      );
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
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      toast.error("Title and message cannot be empty");
      return;
    }
    try {
      await createAnnouncement({
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
      });
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
      await reviewKYC({
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
      await promoteToAdmin({ userId: promoteTarget.userId });
      toast.success("User promoted to Admin");
      setPromoteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setIsPromoting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 font-bold uppercase text-[10px]">
            Active
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-bold uppercase text-[10px]">
            Pending
          </Badge>
        );
      case "sold":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold uppercase text-[10px]">
            Sold
          </Badge>
        );
      case "unsold":
        return (
          <Badge className="bg-muted text-muted-foreground font-bold uppercase text-[10px]">
            Unsold
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="font-bold uppercase text-[10px]"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-10">
      {/* Header & Quick Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px]">
            Command Center
          </Badge>
          <h1 className="text-6xl font-black uppercase tracking-tighter">
            Admin Portal
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
            Global management and marketplace oversight.
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-2 rounded-xl">
                <Megaphone className="h-4 w-4" /> Announce
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Broadcast Announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Maintenance Update"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    placeholder="We will be offline for..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSendAnnouncement}>Broadcast</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
              <StatCard
                label="Live Auctions"
                value={stats.activeAuctions}
                icon={<Gavel className="h-4 w-4" />}
                color="text-green-500"
              />
              <StatCard
                label="Total Users"
                value={stats.totalUsers}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label="Moderation"
                value={stats.pendingReview}
                icon={<Clock className="h-4 w-4" />}
                color={stats.pendingReview > 0 ? "text-yellow-500" : ""}
              />
              <StatCard
                label="Platform Growth"
                value="—"
                icon={<TrendingUp className="h-4 w-4" />}
                color="text-primary"
              />
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 pt-4 overflow-x-auto w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-nowrap md:flex-wrap w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger
              value="moderation"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Moderation</span>
              {pendingAuctions.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 text-[9px]"
                >
                  {pendingAuctions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="auctions"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Hammer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger
              value="support"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder={
                  activeTab === "users" ? "Search Users..." : "Search..."
                }
                className="pl-10 h-11 w-[200px] lg:w-[300px] bg-muted/30 border-2 rounded-xl focus:ring-primary/20"
                value={activeTab === "users" ? userSearch : auctionSearch}
                onChange={(e) =>
                  activeTab === "users"
                    ? setUserSearch(e.target.value)
                    : setAuctionSearch(e.target.value)
                }
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 border-2 rounded-xl"
              aria-label="Filter results"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* --- MODERATION TAB --- */}
        <TabsContent
          value="moderation"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Pending Review
                </h2>
                <Badge variant="outline">{pendingAuctions.length}</Badge>
              </div>
              {pendingAuctions.map((auction) => (
                <ModerationCard
                  key={auction._id}
                  auction={auction}
                  onApprove={async () => {
                    try {
                      await approveAuction({ auctionId: auction._id });
                      toast.success("Approved");
                    } catch {
                      toast.error("Error approving");
                    }
                  }}
                  onReject={async () => {
                    try {
                      await rejectAuction({ auctionId: auction._id });
                      toast.success("Rejected");
                    } catch {
                      toast.error("Error rejecting");
                    }
                  }}
                  onView={() => navigate(`/auction/${auction._id}`)}
                />
              ))}
              {pendingAuctions.length === 0 && (
                <EmptyState label="Queue is Clear" icon={<Check />} />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  Live Auction Monitor
                </h2>
                <Badge
                  variant="outline"
                  className="animate-pulse bg-green-500/10 text-green-600 border-green-500/20"
                >
                  Active
                </Badge>
              </div>
              <BidMonitor />
            </div>
          </div>
        </TabsContent>

        {/* --- MARKETPLACE TAB --- */}
        <TabsContent
          value="auctions"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
        >
          <Card className="border-2 overflow-hidden bg-card/50">
            {selectedAuctions.length > 0 && (
              <div className="bg-primary/10 border-b-2 p-4 flex items-center justify-between animate-in slide-in-from-top-4">
                <p className="text-sm font-black uppercase tracking-tight">
                  {selectedAuctions.length} Items Selected
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setBulkStatusTarget("active")}
                    disabled={isBulkProcessing}
                    className="font-bold uppercase text-xs h-9"
                  >
                    Mark Active
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setBulkStatusTarget("unsold")}
                    disabled={isBulkProcessing}
                    variant="outline"
                    className="font-bold uppercase text-xs h-9"
                  >
                    End Unsold
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSelectedAuctions([])}
                    disabled={isBulkProcessing}
                    variant="ghost"
                    className="font-bold uppercase text-xs h-9"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b-2">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedAuctions.length === filteredAuctions.length &&
                        filteredAuctions.length > 0
                      }
                      onCheckedChange={(checked) => {
                        setSelectedAuctions(
                          checked ? filteredAuctions.map((a) => a._id) : [],
                        );
                      }}
                      aria-label="Select all auctions"
                    />
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                    Status
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                    Title / ID
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                    Make & Model
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                    Prices (Start/Res/Curr)
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                    Ends
                  </TableHead>
                  <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuctions.map((a) => (
                  <TableRow
                    key={a._id}
                    className="group hover:bg-muted/20 border-b"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedAuctions.includes(a._id)}
                        onCheckedChange={(checked) => {
                          setSelectedAuctions((prev) =>
                            checked
                              ? [...prev, a._id]
                              : prev.filter((id) => id !== a._id),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                          {a.title}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">
                          {a._id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-black uppercase tracking-tight">
                          {a.make}
                        </span>
                        <span className="mx-1.5 opacity-30">/</span>
                        <span className="text-muted-foreground font-medium">
                          {a.model}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-2 text-[9px] font-black py-0 px-1.5 h-4 border-2"
                        >
                          {a.year}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-3 text-xs font-bold font-mono">
                        <span
                          title="Starting"
                          className="text-muted-foreground"
                        >
                          R {a.startingPrice.toLocaleString()}
                        </span>
                        <span
                          title="Reserve"
                          className="text-primary border-x px-2"
                        >
                          R {a.reservePrice.toLocaleString()}
                        </span>
                        <span title="Current" className="text-green-600">
                          R {a.currentPrice.toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(a.endTime).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 group-hover:bg-background shadow-none border-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl p-2 border-2"
                        >
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground">
                            Modify Record
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => navigate(`/auction/${a._id}`)}
                            className="rounded-lg font-bold gap-2"
                          >
                            <Eye className="h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-primary focus:text-primary font-bold rounded-lg gap-2"
                            onClick={() =>
                              toast.info("Bidding editor coming soon")
                            }
                          >
                            <Hammer className="h-4 w-4" /> Edit Bidding
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive font-bold rounded-lg gap-2"
                            onClick={() =>
                              toast.info(
                                "Force end logic pending implementation",
                              )
                            }
                          >
                            <AlertCircle className="h-4 w-4" /> Force End
                          </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {auctionsStatus === "CanLoadMore" && (
              <div className="p-4 border-t bg-muted/20 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMoreAuctions(50)}
                  className="font-bold uppercase text-[10px] tracking-widest border-2"
                >
                  Load More Auctions
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* --- USERS TAB --- */}
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
                {filteredUsers.map((p) => (
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
                        {/* KYC Status Display */}
                        {p.kycStatus === "pending" && (
                          <Badge
                            className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[9px] uppercase cursor-pointer"
                            onClick={() => handleReviewKYCClick(p.userId)}
                          >
                            {isFetchingKYC && kycReviewUser?.userId === p.userId ? (
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
                            {isFetchingKYC && kycReviewUser?.userId === p.userId ? (
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
                              onClick={async () => {
                                try {
                                  await verifyUser({ userId: p.userId });
                                  toast.success("User verified");
                                } catch {
                                  toast.error("Verification failed");
                                }
                              }}
                            >
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
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

        {/* --- NEW TABS --- */}
        <TabsContent value="finance">
          <FinanceTab />
        </TabsContent>
        <TabsContent value="support">
          <SupportTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>

        {/* --- SETTINGS TAB --- */}
        <TabsContent
          value="settings"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SettingsCard
              title="Equipment Metadata"
              description="Manage makes, models, and categories."
              icon={<Hammer />}
              action={() =>
                toast.info("Opening Equipment Metadata Management...")
              }
            />
            <SettingsCard
              title="Platform Fees"
              description="Configure commission rates and listing fees."
              icon={<TrendingUp />}
              action={() => toast.info("Opening Fee Configuration...")}
            />
            <SettingsCard
              title="Security Logs"
              description="Audit administrative actions and access."
              icon={<ShieldCheck />}
              action={() => setActiveTab("audit")}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* --- KYC REVIEW DIALOG --- */}
      <Dialog
        open={!!kycReviewUser}
        onOpenChange={(open) => {
          if (!open) {
            setKycReviewUser(null);
            setShowFullId(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              KYC Verification Review
            </DialogTitle>
          </DialogHeader>
          {kycReviewUser && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Fingerprint className="h-3 w-3" /> Personal Details
                  </h3>
                  <div className="space-y-3">
                    <DetailItem
                      label="Full Names"
                      value={
                        [kycReviewUser.firstName, kycReviewUser.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"
                      }
                      icon={<UserCheck className="h-4 w-4" />}
                    />
                    <div className="relative group">
                      <DetailItem
                        label="ID/Passport"
                        value={
                          showFullId
                            ? kycReviewUser.idNumber || "Not Provided"
                            : kycReviewUser.idNumber
                              ? `****${kycReviewUser.idNumber.slice(-4)}`
                              : "Not Provided"
                        }
                        icon={<Fingerprint className="h-4 w-4" />}
                      />
                      {kycReviewUser.idNumber && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[8px] font-black uppercase absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setShowFullId(!showFullId)}
                        >
                          {showFullId ? "Hide" : "Reveal"}
                        </Button>
                      )}
                    </div>
                    <DetailItem
                      label="Phone"
                      value={kycReviewUser.phoneNumber || "Not Provided"}
                      icon={<Phone className="h-4 w-4" />}
                    />
                    <DetailItem
                      label="Email"
                      value={kycReviewUser.kycEmail || "Not Provided"}
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <FileText className="h-3 w-3" /> Submitted Documents
                  </h3>
                  <div className="space-y-2">
                    {kycReviewUser.kycDocuments?.map(
                      (url: string, i: number) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="w-full justify-start font-bold uppercase text-[10px] h-10 border-2 gap-2"
                          onClick={() => {
                            try {
                              if (!url || typeof url !== "string")
                                throw new Error("Missing document URL");
                              const parsed = new URL(url);
                              if (
                                parsed.protocol !== "http:" &&
                                parsed.protocol !== "https:"
                              )
                                throw new Error("Invalid protocol");
                              window.open(url, "_blank", "noopener,noreferrer");
                            } catch (err) {
                              console.error("KYC Document Access Error:", err);
                              toast.error(
                                "Invalid or restricted document link",
                              );
                            }
                          }}
                        >
                          <Eye className="h-3 w-3" /> View Document {i + 1}
                        </Button>
                      ),
                    )}
                    {(!kycReviewUser.kycDocuments ||
                      kycReviewUser.kycDocuments.length === 0) && (
                      <p className="text-xs text-muted-foreground font-medium italic">
                        No documents uploaded.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Rejection Reason (Required for Reject)
                </Label>
                <Textarea
                  placeholder="e.g. Documents are blurry or ID number doesn't match..."
                  value={kycRejectionReason}
                  onChange={(e) => setKycRejectionReason(e.target.value)}
                  className="border-2 rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-2 font-black uppercase text-xs h-12 px-8 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleKycReview("reject")}
              disabled={!kycRejectionReason}
            >
              <X className="h-4 w-4 mr-2" /> Reject Application
            </Button>
            <Button
              className="font-black uppercase text-xs h-12 px-8 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
              onClick={() => handleKycReview("approve")}
            >
              <Check className="h-4 w-4 mr-2" /> Approve & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- BULK ACTION CONFIRMATION --- */}
      <AlertDialog
        open={!!bulkStatusTarget}
        onOpenChange={(open) => !open && setBulkStatusTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">
              Perform Bulk Status Update?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-sm">
              You are about to update{" "}
              <span className="font-bold text-primary">
                {selectedAuctions.length} auctions
              </span>{" "}
              to status{" "}
              <span className="font-bold text-primary uppercase">
                {bulkStatusTarget}
              </span>
              . This action is auditable and affects marketplace visibility.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStatusUpdate}
              disabled={isBulkProcessing}
              className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px]"
            >
              {isBulkProcessing ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- PROMOTE ACTION CONFIRMATION --- */}
      <AlertDialog
        open={!!promoteTarget}
        onOpenChange={(open) => !open && setPromoteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive">
              Elevate to Admin Role?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-sm">
              You are about to promote{" "}
              <span className="font-bold text-primary">
                {promoteTarget?.name || promoteTarget?.email}
              </span>{" "}
              to <span className="font-bold text-destructive">ADMIN</span>. This
              grants full access to all moderation, financial, and system
              settings. This action is recorded in the audit logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handlePromote();
              }}
              disabled={isPromoting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase text-[10px]"
            >
              {isPromoting ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Confirm Promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Renders a labeled detail row with a square icon and a value.
 *
 * @param label - The uppercase label displayed above the value.
 * @param value - The primary text shown for the detail; displays `"Not Provided"` when empty.
 * @param icon - A React node rendered inside the square icon container.
 * @returns A JSX element containing the icon, label, and value arranged horizontally.
 */
function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border">
        {icon}
      </div>
      <div>
        <p className="text-[8px] font-black uppercase text-muted-foreground leading-none mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold tracking-tight">
          {value || "Not Provided"}
        </p>
      </div>
    </div>
  );
}

/**
 * Renders a compact statistic card showing a label, a prominent value, and an icon.
 *
 * @param label - Short uppercase label displayed above the value
 * @param value - Numeric or string statistic shown prominently
 * @param icon - Visual icon displayed on the right side of the card
 * @param color - Optional CSS class applied to the value for color/styling
 * @returns A Card element containing the labeled statistic and icon
 */

function StatCard({
  label,
  value,
  icon,
  color = "",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="p-4 border-2 flex items-center justify-between bg-card/30 backdrop-blur-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </p>
        <p className={cn("text-2xl font-black", color)}>{value}</p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
    </Card>
  );
}

/**
 * Render a moderation card for a single auction with actions to approve, reject, or view details.
 *
 * @param auction - Auction document (includes images, year, title, make, location, startingPrice, and conditionChecklist) used to populate the card UI
 * @param onApprove - Callback invoked when the Approve button is clicked
 * @param onReject - Callback invoked when the Reject button is clicked
 * @param onView - Callback invoked when the Details button is clicked
 * @returns A React element representing the moderation card
 */
function ModerationCard({
  auction,
  onApprove,
  onReject,
  onView,
}: {
  auction: Doc<"auctions">;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}) {
  const images = normalizeAuctionImages(
    auction.images as AuctionImages | string[] | undefined,
  );
  return (
    <Card className="p-5 border-2 hover:border-primary/40 transition-all bg-card/40 backdrop-blur-md group">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-56 h-40 bg-muted rounded-xl border-2 relative overflow-hidden shrink-0">
          {images.front ? (
            <img
              src={images.front}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase rounded-lg backdrop-blur-sm border border-white/10">
            {auction.year}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                {auction.title}
              </h3>
              <div className="flex gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="font-bold border-2 py-0 h-6"
                >
                  {auction.make}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-bold border-2 py-0 h-6 uppercase text-[9px] tracking-wider"
                >
                  {auction.location}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-muted-foreground">
                Starting At
              </p>
              <p className="text-xl font-black text-primary">
                R {auction.startingPrice.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 p-3 bg-muted/20 rounded-xl border-2 border-dashed">
            <ConditionItem
              label="Engine"
              value={auction.conditionChecklist?.engine}
            />
            <ConditionItem
              label="Hydraulics"
              value={auction.conditionChecklist?.hydraulics}
            />
            <ConditionItem
              label="Tires"
              value={auction.conditionChecklist?.tires}
            />
            <ConditionItem
              label="History"
              value={auction.conditionChecklist?.serviceHistory}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center shrink-0 w-full md:w-auto">
          <Button
            onClick={onApprove}
            className="h-10 px-6 rounded-xl font-black uppercase text-xs bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/10"
          >
            <Check className="h-4 w-4 mr-2" /> Approve
          </Button>
          <Button
            onClick={onReject}
            variant="outline"
            className="h-10 px-6 rounded-xl font-black uppercase text-xs border-2 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100"
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Render a compact labeled condition indicator that visually shows whether a condition passed or failed.
 */
function ConditionItem({ label, value }: { label: string; value?: boolean }) {
  return (
    <div className="space-y-1 text-center md:text-left">
      <p className="text-[8px] font-black uppercase text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-1">
        {value === true ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : value === false ? (
          <X className="h-3 w-3 text-destructive" />
        ) : (
          <span className="h-3 w-3 text-muted-foreground">—</span>
        )}
        <span className="text-[10px] font-bold uppercase">
          {value === true ? "PASS" : value === false ? "FAIL" : "N/A"}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders an interactive settings card that displays an icon, title, and description and invokes an action when clicked.
 *
 * @param title - Visible card title shown in uppercase
 * @param description - Supporting descriptive text displayed below the title
 * @param icon - Visual icon node shown in the card header area
 * @param action - Callback executed when the card is clicked
 * @returns A Card element containing the provided icon, title, and description that calls `action` on click
 */
function SettingsCard({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}) {
  return (
    <Card
      className="p-6 border-2 hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-48 bg-card/30"
      onClick={action}
    >
      <div className="space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all border-2">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-black uppercase tracking-tight text-lg">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Displays a stylized empty-state placeholder containing an icon and a label.
 *
 * @param label - Primary uppercase label text shown below the icon
 * @param icon - Icon node rendered inside the circular icon container
 * @returns The placeholder element showing the provided icon and label
 */
function EmptyState({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card/30 border-2 border-dashed rounded-3xl p-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto text-primary/30 border-2 border-primary/10">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-black uppercase tracking-tight">{label}</h3>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em]">
          Operational Equilibrium Reached
        </p>
      </div>
    </div>
  );
}
