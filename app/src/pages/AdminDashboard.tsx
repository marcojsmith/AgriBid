// app/src/pages/AdminDashboard.tsx
import { useQuery, useMutation } from "convex/react";
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
  TableRow 
} from "@/components/ui/table";
import { 
  Check, 
  X, 
  Eye, 
  Clock, 
  Hammer, 
  Loader2, 
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
  Megaphone
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import type { Id } from "convex/_generated/dataModel";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Import Sub-Tabs
import { FinanceTab } from "@/components/admin/FinanceTab";
import { SupportTab } from "@/components/admin/SupportTab";
import { AuditTab } from "@/components/admin/AuditTab";
import { BidMonitor } from "@/components/admin/BidMonitor";

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // Queries
  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const allAuctions = useQuery(api.auctions.getAllAuctions);
  const allProfiles = useQuery(api.users.listAllProfiles);

  // Mutations
  const approveAuction = useMutation(api.auctions.approveAuction);
  const rejectAuction = useMutation(api.auctions.rejectAuction);
  const bulkUpdateAuctions = useMutation(api.auctions.bulkUpdateAuctions);
  const verifyUser = useMutation(api.users.verifyUser);
  const promoteToAdmin = useMutation(api.users.promoteToAdmin);
  const createAnnouncement = useMutation(api.admin.createAnnouncement);

  // State
  const [activeTab, setActiveTab] = useState("moderation");
  const [auctionSearch, setAuctionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedAuctions, setSelectedAuctions] = useState<Id<"auctions">[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  // Announcement State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  // Filtered data
  const filteredAuctions = useMemo(() => {
    if (!allAuctions) return [];
    return allAuctions.filter(a => 
      a.title.toLowerCase().includes(auctionSearch.toLowerCase()) ||
      a.make.toLowerCase().includes(auctionSearch.toLowerCase()) ||
      a.model.toLowerCase().includes(auctionSearch.toLowerCase())
    );
  }, [allAuctions, auctionSearch]);

  const filteredUsers = useMemo(() => {
    if (!allProfiles) return [];
    return allProfiles.filter(p => 
      (p.name?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
      (p.email?.toLowerCase() || "").includes(userSearch.toLowerCase()) ||
      p.userId.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [allProfiles, userSearch]);

  const stats = useMemo(() => {
    if (!allAuctions || !allProfiles) return null;
    return {
      totalAuctions: allAuctions.length,
      activeAuctions: allAuctions.filter(a => a.status === "active").length,
      pendingReview: allAuctions.filter(a => a.status === "pending_review").length,
      totalUsers: allProfiles.length,
      verifiedSellers: allProfiles.filter(p => p.isVerified).length,
    };
  }, [allAuctions, allProfiles]);

  if (pendingAuctions === undefined || allAuctions === undefined || allProfiles === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
          Initializing Terminal...
        </p>
      </div>
    );
  }

  const handleBulkStatusUpdate = async (status: "active" | "rejected" | "sold" | "unsold") => {
    if (selectedAuctions.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await bulkUpdateAuctions({ auctionIds: selectedAuctions, updates: { status } });
      toast.success(`Updated ${selectedAuctions.length} auctions to ${status}`);
      setSelectedAuctions([]);
    } catch (error) {
      toast.error("Bulk update failed");
    } finally {
      setIsBulkProcessing(null as any); 
      setIsBulkProcessing(false);
    }
  };

  const handleSendAnnouncement = async () => {
    try {
        await createAnnouncement({ title: announcementTitle, message: announcementMessage });
        toast.success("Announcement sent");
        setAnnouncementOpen(false);
        setAnnouncementTitle("");
        setAnnouncementMessage("");
    } catch (e) {
        toast.error("Failed to send");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 font-bold uppercase text-[10px]">Active</Badge>;
      case "pending_review": return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-bold uppercase text-[10px]">Pending</Badge>;
      case "sold": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold uppercase text-[10px]">Sold</Badge>;
      case "unsold": return <Badge className="bg-muted text-muted-foreground font-bold uppercase text-[10px]">Unsold</Badge>;
      case "rejected": return <Badge variant="destructive" className="font-bold uppercase text-[10px]">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
          <h1 className="text-6xl font-black uppercase tracking-tighter">Admin Portal</h1>
          <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
            Global management and marketplace oversight.
          </p>
        </div>

        <div className="flex gap-4 items-center">
            {/* Announcement Dialog */}
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
                            <Input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} placeholder="Maintenance Update" />
                        </div>
                        <div className="space-y-2">
                            <Label>Message</Label>
                            <Textarea value={announcementMessage} onChange={e => setAnnouncementMessage(e.target.value)} placeholder="We will be offline for..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSendAnnouncement}>Broadcast</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
                <StatCard label="Live Auctions" value={stats.activeAuctions} icon={<Gavel className="h-4 w-4" />} color="text-green-500" />
                <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="h-4 w-4" />} />
                <StatCard label="Moderation" value={stats.pendingReview} icon={<Clock className="h-4 w-4" />} color={stats.pendingReview > 0 ? "text-yellow-500" : ""} />
                <StatCard label="Platform Growth" value="+12%" icon={<TrendingUp className="h-4 w-4" />} color="text-primary" />
            </div>
            )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 pt-4 overflow-x-auto w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-nowrap md:flex-wrap w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="moderation" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Moderation</span>
              {pendingAuctions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[9px]">{pendingAuctions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="auctions" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <Hammer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="finance" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder={activeTab === "users" ? "Search Users..." : "Search..."} 
                className="pl-10 h-11 w-[200px] lg:w-[300px] bg-muted/30 border-2 rounded-xl focus:ring-primary/20"
                value={activeTab === "users" ? userSearch : auctionSearch}
                onChange={(e) => activeTab === "users" ? setUserSearch(e.target.value) : setAuctionSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11 border-2 rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* --- MODERATION TAB --- */}
        <TabsContent value="moderation" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight">Pending Review</h2>
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
                    } catch (e) { toast.error("Error approving"); }
                    }}
                    onReject={async () => {
                    try {
                        await rejectAuction({ auctionId: auction._id });
                        toast.success("Rejected");
                    } catch (e) { toast.error("Error rejecting"); }
                    }}
                    onView={() => navigate(`/auction/${auction._id}`)}
                />
                ))}
                {pendingAuctions.length === 0 && <EmptyState label="Queue is Clear" icon={<Check />} />}
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight">Live Auction Monitor</h2>
                    <Badge variant="outline" className="animate-pulse bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                </div>
                <BidMonitor />
            </div>
          </div>
        </TabsContent>

        {/* --- MARKETPLACE TAB --- */}
        <TabsContent value="auctions" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-2 overflow-hidden bg-card/50">
            {selectedAuctions.length > 0 && (
              <div className="bg-primary/10 border-b-2 p-4 flex items-center justify-between animate-in slide-in-from-top-4">
                <p className="text-sm font-black uppercase tracking-tight">
                  {selectedAuctions.length} Items Selected
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleBulkStatusUpdate("active")} 
                    disabled={isBulkProcessing}
                    className="font-bold uppercase text-xs h-9"
                  >
                    {isBulkProcessing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    Mark Active
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleBulkStatusUpdate("unsold")} 
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
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedAuctions.length === filteredAuctions.length && filteredAuctions.length > 0}
                      onCheckedChange={(checked) => {
                        setSelectedAuctions(checked ? filteredAuctions.map(a => a._id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Status</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Title / ID</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Make & Model</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Prices (Start/Res/Curr)</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Ends</TableHead>
                  <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuctions.map((a) => (
                  <TableRow key={a._id} className="group hover:bg-muted/20 border-b">
                    <TableCell>
                      <Checkbox 
                        checked={selectedAuctions.includes(a._id)}
                        onCheckedChange={(checked) => {
                          setSelectedAuctions(prev => checked ? [...prev, a._id] : prev.filter(id => id !== a._id));
                        }}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{a.title}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">{a._id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-black uppercase tracking-tight">{a.make}</span>
                        <span className="mx-1.5 opacity-30">/</span>
                        <span className="text-muted-foreground font-medium">{a.model}</span>
                        <Badge variant="outline" className="ml-2 text-[9px] font-black py-0 px-1.5 h-4 border-2">{a.year}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-3 text-xs font-bold font-mono">
                        <span title="Starting" className="text-muted-foreground">R{a.startingPrice.toLocaleString()}</span>
                        <span title="Reserve" className="text-primary border-x px-2">R{a.reservePrice.toLocaleString()}</span>
                        <span title="Current" className="text-green-600">R{a.currentPrice.toLocaleString()}</span>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:bg-background shadow-none border-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 border-2">
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground">Modify Record</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => navigate(`/auction/${a._id}`)} className="rounded-lg font-bold gap-2">
                            <Eye className="h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-primary focus:text-primary font-bold rounded-lg gap-2">
                            <Hammer className="h-4 w-4" /> Edit Bidding
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive font-bold rounded-lg gap-2">
                            <AlertCircle className="h-4 w-4" /> Force End
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* --- USERS TAB --- */}
        <TabsContent value="users" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <Card className="border-2 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b-2">
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Identity</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Role / Perms</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Verified</TableHead>
                  <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">Joined</TableHead>
                  <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">Action</TableHead>
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
                          <p className="text-xs text-muted-foreground font-medium">{p.email || "No email"}</p>
                          <p className="text-[9px] font-mono opacity-50 uppercase">{p.userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.role === "admin" ? "default" : "outline"} className="font-black uppercase text-[10px] tracking-widest px-2.5">
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
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[9px] uppercase">KYC Pending</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        {!p.isVerified && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 border-2 font-black uppercase text-[10px] tracking-wider"
                            onClick={() => verifyUser({ userId: p.userId })}
                          >
                            Verify
                          </Button>
                        )}
                        {p.role !== "admin" && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 border-2 font-black uppercase text-[10px] tracking-wider"
                            onClick={() => promoteToAdmin({ userId: p.userId })}
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
        <TabsContent value="settings" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SettingsCard 
              title="Equipment Metadata" 
              description="Manage makes, models, and categories." 
              icon={<Hammer />}
              action={() => {}} 
            />
            <SettingsCard 
              title="Platform Fees" 
              description="Configure commission rates and listing fees." 
              icon={<TrendingUp />}
              action={() => {}} 
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
    </div>
  );
}

// --- HELPER COMPONENTS ---

function StatCard({ label, value, icon, color = "" }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) {
  return (
    <Card className="p-4 border-2 flex items-center justify-between bg-card/30 backdrop-blur-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
        <p className={cn("text-2xl font-black", color)}>{value}</p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
    </Card>
  );
}

function ModerationCard({ auction, onApprove, onReject, onView }: { auction: any, onApprove: () => void, onReject: () => void, onView: () => void }) {
  return (
    <Card className="p-5 border-2 hover:border-primary/40 transition-all bg-card/40 backdrop-blur-md group">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-56 h-40 bg-muted rounded-xl border-2 relative overflow-hidden shrink-0">
          {auction.images?.front ? (
            <img src={auction.images.front} className="absolute inset-0 w-full h-full object-cover" alt="" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><Clock className="h-8 w-8 text-muted-foreground/20" /></div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase rounded-lg backdrop-blur-sm border border-white/10">{auction.year}</div>
        </div>
        
        <div className="flex-1 space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{auction.title}</h3>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline" className="font-bold border-2 py-0 h-6">{auction.make}</Badge>
                <Badge variant="outline" className="font-bold border-2 py-0 h-6 uppercase text-[9px] tracking-wider">{auction.location}</Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-muted-foreground">Starting At</p>
              <p className="text-xl font-black text-primary">R {auction.startingPrice.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 p-3 bg-muted/20 rounded-xl border-2 border-dashed">
             <ConditionItem label="Engine" value={auction.conditionChecklist?.engine} />
             <ConditionItem label="Hydraulics" value={auction.conditionChecklist?.hydraulics} />
             <ConditionItem label="Tires" value={auction.conditionChecklist?.tires} />
             <ConditionItem label="History" value={auction.conditionChecklist?.serviceHistory} />
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center shrink-0 w-full md:w-auto">
          <Button onClick={onApprove} className="h-10 px-6 rounded-xl font-black uppercase text-xs bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/10"><Check className="h-4 w-4 mr-2" /> Approve</Button>
          <Button onClick={onReject} variant="outline" className="h-10 px-6 rounded-xl font-black uppercase text-xs border-2 hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4 mr-2" /> Reject</Button>
          <Button onClick={onView} variant="ghost" className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100">Details</Button>
        </div>
      </div>
    </Card>
  );
}

function ConditionItem({ label, value }: { label: string, value?: boolean }) {
  return (
    <div className="space-y-1 text-center md:text-left">
      <p className="text-[8px] font-black uppercase text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {value ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
        <span className="text-[10px] font-bold uppercase">{value ? "PASS" : "FAIL"}</span>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, icon, action }: { title: string, description: string, icon: React.ReactNode, action: () => void }) {
  return (
    <Card className="p-6 border-2 hover:border-primary/40 transition-all cursor-pointer group flex flex-col justify-between h-48 bg-card/30" onClick={action}>
      <div className="space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all border-2">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-black uppercase tracking-tight text-lg">{title}</h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">{description}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ label, icon }: { label: string, icon: React.ReactNode }) {
  return (
    <div className="bg-card/30 border-2 border-dashed rounded-3xl p-20 text-center space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto text-primary/30 border-2 border-primary/10">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-xl font-black uppercase tracking-tight">{label}</h3>
        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em]">Operational Equilibrium Reached</p>
      </div>
    </div>
  );
}
