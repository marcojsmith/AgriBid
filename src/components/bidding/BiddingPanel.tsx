// app/src/components/bidding/BiddingPanel.tsx
import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useLocation, useNavigate, Link } from "react-router-dom";
import type { Doc } from "convex/_generated/dataModel";
import { Gavel, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { BidConfirmation } from "@/components/BidConfirmation";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { isValidCallbackUrl } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePriceHighlight } from "@/hooks/usePriceHighlight";
import { useErrorHandler } from "@/hooks/useErrorHandler";

import { BidForm } from "./BidForm";

interface BiddingPanelProps {
  auction: Doc<"auctions">;
}

/**
 * Bidding panel component for auction detail pages.
 *
 * Provides the interactive bidding interface including current bid display,
 * countdown timer, bid form, and confirmation dialog. This component is
 * part of the public bidding API.
 *
 * @param props - The component props
 * @param props.auction - The auction object containing all auction data (status, currentPrice, minIncrement, endTime, etc.)
 * @returns A React element rendering the bidding panel with bid form and confirmation
 */
export const BiddingPanel = ({
  auction,
}: BiddingPanelProps): React.ReactElement => {
  const { data: session, isPending } = useSession();
  const userData = useQuery(api.users.getMyProfile);
  const myProxyBid = useQuery(
    api.auctions.getMyProxyBid,
    session ? { auctionId: auction._id } : "skip"
  );
  const location = useLocation();
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<{
    amount: number;
    maxBid?: number;
  }>({ amount: 0 });
  const [isBidding, setIsBidding] = useState(false);

  const placeBid = useMutation(api.auctions.mutations.bidding.placeBid);
  const { handleError } = useErrorHandler({
    reportToGitHub: true,
    context: {
      userId: session?.user?.id,
    },
  });

  const isEnded =
    auction.status !== "active" ||
    (auction.endTime ? auction.endTime <= Date.now() : true);
  const nextMinBid = auction.currentPrice + auction.minIncrement;

  const isHighlighted = usePriceHighlight(auction.currentPrice);

  // Use explicit loading check to avoid false positives for unverified status
  const isProfileLoading = userData === undefined;
  const isVerified = isProfileLoading
    ? false
    : (userData?.profile?.isVerified ?? false);
  const kycStatus = isProfileLoading ? undefined : userData?.profile?.kycStatus;

  if (auction.status !== "active") {
    const isWon = session?.user?.id === auction.winnerId;

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <Badge
            variant={auction.status === "sold" ? "default" : "destructive"}
            className="font-semibold px-4 py-1.5 text-xs mb-2"
          >
            Auction {auction.status}
          </Badge>
          <h3 className="text-3xl font-semibold tabular-nums text-primary tracking-tighter">
            R {auction.currentPrice.toLocaleString("en-ZA")}
          </h3>
          <p className="text-xs font-medium text-muted-foreground">
            Final Price
          </p>
        </div>

        <div className="bg-muted/30 border rounded-md p-6 text-center space-y-4">
          {auction.status === "sold" ? (
            <>
              <div className="h-16 w-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <Gavel className="h-8 w-8 text-success" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">Winning Bid Confirmed</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {isWon
                    ? "Congratulations, you are the buyer!"
                    : "This item has found a new owner."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Info className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Auction Closed</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {auction.currentPrice === auction.startingPrice
                      ? "No bids were placed."
                      : "Reserve price was not met."}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full h-14 rounded-md font-medium border"
          asChild
        >
          <Link to="/">Explore Other Auctions</Link>
        </Button>
      </div>
    );
  }

  const handleBidInitiate = (amount: number, maxBid?: number) => {
    if (isPending) {
      toast.info("Checking sign-in status...");
      return;
    }

    if (!session) {
      toast.info("Please sign in to place a bid");
      // Redirect to login page and provide a callback URL
      const rawUrl = `${location.pathname}${location.search}${location.hash}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    if (isProfileLoading) {
      toast.info("Verifying account status...");
      return;
    }

    if (!isVerified) {
      toast.error("Account verification required to place bids");
      navigate("/kyc");
      return;
    }

    setPendingBid({ amount, maxBid });
    setIsConfirmOpen(true);
  };

  const handleBidConfirm = async () => {
    if (!pendingBid.amount) return;

    // Fresh check for auction end state to prevent late bids
    const freshIsEnded =
      auction.status !== "active" ||
      (auction.endTime ? auction.endTime <= Date.now() : true);

    if (freshIsEnded) {
      toast.error("This auction has ended");
      setIsConfirmOpen(false);
      setPendingBid({ amount: 0 });
      return;
    }

    setIsConfirmOpen(false);
    setIsBidding(true);

    try {
      const result = await placeBid({
        auctionId: auction._id,
        amount: pendingBid.amount,
        maxBid: pendingBid.maxBid,
      });

      if (result.success) {
        toast.success(
          `Bid of R ${pendingBid.amount.toLocaleString("en-ZA")} placed successfully!`
        );
        if (result.proxyBidActive && result.confirmedMaxBid) {
          toast.info(
            `Your proxy bid is active up to R ${result.confirmedMaxBid.toLocaleString("en-ZA")}`
          );
        }
      }
    } catch (error) {
      await handleError(error, "Failed to place bid");
    } finally {
      setIsBidding(false);
      setPendingBid({ amount: 0 });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Current Bid
          </p>
          <div
            className={`flex items-baseline gap-2 rounded-md p-2 border transition-colors duration-700 ${
              !isEnded && isHighlighted
                ? "bg-success/10 border-success/30"
                : "border-transparent"
            }`}
          >
            <span className="text-4xl font-bold tabular-nums text-primary tracking-tighter">
              R {auction.currentPrice.toLocaleString("en-ZA")}
            </span>
            {!isEnded && (
              <Badge
                variant="outline"
                className="bg-primary/5 text-primary border-primary/20 animate-pulse"
              >
                Live
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Time Remaining
          </p>
          <div className="text-xl font-bold">
            <CountdownTimer endTime={auction.endTime} />
          </div>
        </div>
      </div>

      {isEnded ? (
        <div className="bg-muted/50 border border-dashed rounded-md p-6 text-center">
          <p className="font-medium text-muted-foreground text-sm">
            Auction Ended
          </p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Final Price: R {auction.currentPrice.toLocaleString("en-ZA")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {auction.isExtended && (
            <Alert className="bg-warning/10 border-warning/20 text-warning rounded-md py-3 border">
              <Info className="h-4 w-4 text-warning" />
              <AlertTitle className="text-xs font-semibold mb-0.5">
                Soft Close Extended
              </AlertTitle>
              <AlertDescription className="text-[10px] font-normal leading-tight opacity-80">
                Bidding activity has extended the auction to ensure a fair
                finish.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground bg-muted/30 p-3 rounded-lg border">
            <Gavel className="h-4 w-4 text-primary" />
            <span>
              Next minimum bid:{" "}
              <span className="text-foreground tabular-nums">
                R {nextMinBid.toLocaleString("en-ZA")}
              </span>
            </span>
          </div>

          {!isProfileLoading && !isVerified && session && (
            <Alert
              variant="destructive"
              className="bg-destructive/10 border-destructive/20 text-destructive rounded-md py-4 border"
            >
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div className="space-y-1 ml-2">
                <AlertTitle className="text-xs font-semibold mb-1">
                  Verification Required
                </AlertTitle>
                <AlertDescription className="text-[10px] font-normal leading-relaxed opacity-90">
                  {kycStatus === "pending"
                    ? "Your identity verification is currently under review. Bidding will be enabled once approved."
                    : "To ensure marketplace integrity, you must complete identity verification before placing bids."}
                </AlertDescription>
                {kycStatus !== "pending" && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-[10px] font-medium text-destructive underline underline-offset-4"
                    asChild
                  >
                    <Link to="/kyc">Complete KYC Now</Link>
                  </Button>
                )}
              </div>
            </Alert>
          )}

          <BidForm
            auction={auction}
            onBid={handleBidInitiate}
            isLoading={isBidding}
            isBidFormEnabled={true}
            currentUserMaxBid={myProxyBid?.maxBid}
            isProxyActive={!!myProxyBid}
          />
        </div>
      )}

      <BidConfirmation
        isOpen={isConfirmOpen}
        amount={pendingBid.amount || 0}
        maxAmount={pendingBid.maxBid}
        onConfirm={handleBidConfirm}
        onCancel={() => {
          setIsConfirmOpen(false);
          setPendingBid({ amount: 0 });
        }}
      />
    </div>
  );
};
