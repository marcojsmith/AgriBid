// app/src/components/SellerInfo.tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  UserCheck,
  ShieldCheck,
  Mail,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SellerInfoProps {
  sellerId: string;
  /** Optional auction the conversation is about, linked to the message. */
  auctionId?: Id<"auctions">;
  /** True when the viewer is the seller; the Message button stays disabled. */
  isOwnListing?: boolean;
}

/**
 * Component for a seller info card.
 *
 * @param props - Component props.
 * @param props.sellerId - The ID of the seller to display information for.
 * @param props.auctionId - Optional auction ID used to link a started conversation to the auction.
 * @param props.isOwnListing - True when the viewer is the seller themselves; disables the Message button instead of offering an action that would fail server-side.
 * @returns The rendered seller info card.
 */
export const SellerInfo = ({
  sellerId,
  auctionId,
  isOwnListing = false,
}: SellerInfoProps) => {
  const seller = useQuery(api.auctions.getSellerInfo, { sellerId });

  const navigate = useNavigate();
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const startConversation = useMutation(api.messages.startConversation);

  const handleSendMessage = async () => {
    if (message.trim().length === 0) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingMessage(true);
    try {
      const conversationId = await startConversation({
        recipientId: sellerId,
        initialMessage: message,
        auctionId,
      });
      toast.success("Message sent");
      setMessageDialogOpen(false);
      setMessage("");
      void navigate(`/messages/${conversationId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (seller === undefined) {
    return (
      <div className="bg-card border-2 rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (seller === null) {
    return (
      <div className="bg-muted/20 border-2 border-dashed rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground italic">
          Seller information unavailable
        </p>
      </div>
    );
  }

  const memberSince = new Date(seller.createdAt).getFullYear();

  return (
    <div className="bg-card border-2 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-primary/5">
            <UserCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black uppercase tracking-tight">
                {seller.name}
              </h3>
              {seller.isVerified && (
                <ShieldCheck className="h-5 w-5 text-success fill-success/10" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-black uppercase tracking-wider py-0 px-2 h-5 border-primary/20 bg-primary/5 text-primary"
              >
                {seller.role}
              </Badge>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold uppercase">
                <Calendar className="h-3 w-3" />
                Member since {memberSince}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-primary font-black uppercase">
                <TrendingUp className="h-3 w-3" />
                {seller.itemsSold} Items Sold
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={isOwnListing}
              title={isOwnListing ? "This is your own listing" : undefined}
              className="h-11 font-bold rounded-xl border-2 hover:bg-primary/5 hover:border-primary transition-all gap-2"
              aria-label={
                isOwnListing
                  ? "This is your own listing"
                  : `Message ${seller.name}`
              }
            >
              <Mail className="h-4 w-4" />
              Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message Seller</DialogTitle>
              <DialogDescription>
                Send a message to start a conversation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="seller-message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="seller-message"
                  name="seller-message"
                  placeholder="Ask about availability, condition, or delivery..."
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                  }}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMessageDialogOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSendMessage} disabled={isSendingMessage}>
                  {isSendingMessage ? (
                    <>
                      <span className="animate-pulse">Sending...</span>
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          variant="secondary"
          className="h-11 font-bold rounded-xl border-2 border-transparent hover:border-muted-foreground/20 transition-all"
          aria-label={`View ${seller.name}'s profile`}
          asChild
        >
          <Link to={`/profile/${sellerId}`}>View Profile</Link>
        </Button>
      </div>

      {seller.isVerified && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-3 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-success mt-0.5" />
          <p className="text-[10px] text-success font-bold leading-relaxed uppercase tracking-wide">
            This seller has completed our{" "}
            <strong className="text-success-foreground bg-success px-1 rounded-sm">
              High-Integrity Verification
            </strong>{" "}
            process, including identity and business registration checks.
          </p>
        </div>
      )}
    </div>
  );
};
