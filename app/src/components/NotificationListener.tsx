// app/src/components/NotificationListener.tsx
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { useSession } from "../lib/auth-client";

/**
 * Monitors auctions the user is participating in (bidding/watching)
 * and triggers toast notifications when they are settled.
 */
export const NotificationListener = () => {
  const { data: session } = useSession();
  const myBids = useQuery(api.auctions.getMyBids);
  const watched = useQuery(api.watchlist.getWatchedAuctions);

  // Keep track of auction statuses we've already "seen" as settled
  const settledAuctionsRef = useRef<Set<string>>(new Set());

  // Clear cache if user changes (e.g. logout/login)
  const userId = session?.user?.id;
  useEffect(() => {
    settledAuctionsRef.current.clear();
  }, [userId]);

  useEffect(() => {
    if (!session || !myBids || !watched) return;

    // Deduplicate auctions by ID
    const allRelevant = Array.from(
      new Map(
        [...myBids, ...watched].map((a) => [a._id.toString(), a]),
      ).values(),
    );

    for (const auction of allRelevant) {
      const auctionId = auction._id.toString();

      // If the auction is settled and we haven't notified about it in this session
      if (
        (auction.status === "sold" || auction.status === "unsold") &&
        !settledAuctionsRef.current.has(auctionId)
      ) {
        const currentUserId = session.user.id;
        const isWinner =
          !!currentUserId &&
          !!auction.winnerId &&
          auction.winnerId === currentUserId;
        const isSeller =
          !!currentUserId &&
          !!auction.sellerId &&
          auction.sellerId === currentUserId;

        if (auction.status === "sold") {
          if (isWinner) {
            toast.success(
              `Congratulations! You won the auction for ${auction.title}!`,
              {
                duration: 10000,
                description: `Winning Bid: R ${auction.currentPrice.toLocaleString("en-ZA")}`,
              },
            );
          } else if (isSeller) {
            toast.success(
              `Success! Your equipment ${auction.title} has been sold!`,
              {
                duration: 10000,
                description: `Final Price: R ${auction.currentPrice.toLocaleString("en-ZA")}`,
              },
            );
          } else {
            toast.info(`Auction ended: ${auction.title} has been sold.`, {
              description: `Final Price: R ${auction.currentPrice.toLocaleString("en-ZA")}`,
            });
          }
        } else {
          // Unsold
          if (isSeller) {
            toast.error(
              `Auction ended: ${auction.title} did not meet reserve.`,
              {
                duration: 8000,
              },
            );
          } else {
            toast.info(`Auction ended: ${auction.title} was not sold.`, {
              description: "Reserve price not met.",
            });
          }
        }

        settledAuctionsRef.current.add(auctionId);
      }
    }
  }, [myBids, watched, session]);

  return null; // This component doesn't render anything
};
