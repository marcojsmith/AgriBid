// app/src/pages/AdminDashboard.tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Eye, Clock, MapPin, Hammer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { Id } from "convex/_generated/dataModel";

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const approveAuction = useMutation(api.auctions.approveAuction);
  const rejectAuction = useMutation(api.auctions.rejectAuction);

  const [processing, setProcessing] = useState<{ id: Id<"auctions">; action: "approve" | "reject" } | null>(null);

  if (pendingAuctions === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background animate-in fade-in duration-500">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
          Loading Moderation Queue...
        </p>
      </div>
    );
  }

  const handleApprove = async (id: Id<"auctions">) => {
    setProcessing({ id, action: "approve" });
    try {
      await approveAuction({ auctionId: id });
      toast.success("Auction approved and live!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: Id<"auctions">) => {
    setProcessing({ id, action: "reject" });
    try {
      await rejectAuction({ auctionId: id });
      toast.success("Auction rejected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rejection failed");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusLabel = (val: boolean | undefined | null) => {
    if (val === true) return "PASS";
    if (val === false) return "FAIL";
    return "N/A";
  };

  // TODO: Compute from real review data when available
  const avgReviewTime = "2.4h";

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px]">
            Admin Control
          </Badge>
          <h1 className="text-5xl font-black uppercase tracking-tight">Listing Moderation</h1>
          <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
            Review and authorize equipment for the South African marketplace.
          </p>
        </div>
        <div className="bg-card border-2 rounded-2xl p-4 flex gap-8">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-black text-primary">{pendingAuctions.length}</p>
          </div>
          <div className="w-px bg-border h-full" />
          <div className="text-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Avg Review</p>
            <p className="text-2xl font-black">{avgReviewTime}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {pendingAuctions.map((auction) => (
          <Card key={auction._id} className="p-6 border-2 hover:border-primary/40 transition-all bg-card/50 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Visual Preview */}
              <div className="w-full md:w-64 h-48 bg-muted rounded-xl border-2 flex items-center justify-center relative overflow-hidden">
                {(!Array.isArray(auction.images) && auction.images.front) ? (
                  <img 
                    src={auction.images.front} 
                    alt={auction.title} 
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Clock className="h-12 w-12 text-muted-foreground/20" />
                )}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur text-white text-[10px] font-black uppercase rounded-lg">
                  {auction.year}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{auction.title}</h3>
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="outline" className="font-bold border-2 gap-1.5 py-1">
                        <Hammer className="h-3 w-3" />
                        {auction.make}
                      </Badge>
                      <Badge variant="outline" className="font-bold border-2 gap-1.5 py-1">
                        <MapPin className="h-3 w-3" />
                        {auction.location}
                      </Badge>
                      <Badge variant="outline" className="font-bold border-2 py-1">
                        {auction.operatingHours} HRS
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Reserve Price</p>
                    <p className="text-xl font-black text-primary">R {auction.reservePrice.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border-2 border-dashed">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Engine</p>
                    <p className="text-xs font-bold uppercase">{getStatusLabel(auction.conditionChecklist?.engine)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Hydraulics</p>
                    <p className="text-xs font-bold uppercase">{getStatusLabel(auction.conditionChecklist?.hydraulics)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Tires</p>
                    <p className="text-xs font-bold uppercase">{getStatusLabel(auction.conditionChecklist?.tires)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase text-muted-foreground">History</p>
                    <p className="text-xs font-bold uppercase">{getStatusLabel(auction.conditionChecklist?.serviceHistory)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 justify-center">
                <Button 
                  className="h-12 px-8 rounded-xl font-black text-sm uppercase tracking-wider bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                  onClick={() => handleApprove(auction._id)}
                  disabled={!!processing}
                >
                  {processing?.id === auction._id && processing.action === "approve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 px-8 rounded-xl font-black text-sm uppercase tracking-wider border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                  onClick={() => handleReject(auction._id)}
                  disabled={!!processing}
                >
                  {processing?.id === auction._id && processing.action === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest gap-2"
                  onClick={() => navigate(`/auction/${auction._id}`)}
                  disabled={!!processing}
                >
                  <Eye className="h-4 w-4" />
                  Full Details
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {pendingAuctions.length === 0 && (
          <div className="bg-card border-2 border-dashed rounded-3xl p-24 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-primary/40" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black uppercase">Queue is Clear</h3>
              <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">All equipment has been moderated.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
