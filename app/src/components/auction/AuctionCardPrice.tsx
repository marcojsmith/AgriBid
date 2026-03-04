// app/src/components/auction/AuctionCardPrice.tsx
import { usePriceHighlight } from "@/hooks/usePriceHighlight";

import { CountdownTimer } from "../CountdownTimer";

interface AuctionCardPriceProps {
  currentPrice: number;
  endTime?: number;
  isCompact: boolean;
  isClosed: boolean;
}

/**
 * Display the current bid and auction countdown, or render nothing in compact mode.
 *
 * @param currentPrice.currentPrice
 * @param currentPrice - The current bid amount in rand
 * @param endTime - Optional auction end timestamp in milliseconds used to initialise the countdown
 * @param isCompact - If `true`, nothing is rendered
 * @param isClosed - If `true`, the countdown is hidden (auction is sold or unsold)
 * @param currentPrice.endTime
 * @param currentPrice.isCompact
 * @param currentPrice.isClosed
 * @returns The rendered price-and-countdown markup, or `null` when `isCompact` is `true`.
 */
export function AuctionCardPrice({
  currentPrice,
  endTime,
  isCompact,
  isClosed,
}: AuctionCardPriceProps) {
  const isHighlighted = usePriceHighlight(currentPrice);

  if (isCompact) return null;

  return (
    <div className="flex justify-between items-end mt-2 md:mt-4">
      <div
        className={`rounded-lg p-2 border-2 transition-colors duration-700 ${
          isHighlighted
            ? "bg-green-500/10 border-green-500/30"
            : "border-transparent"
        }`}
      >
        <p className="text-muted-foreground uppercase font-black tracking-widest text-[10px] md:text-xs">
          Current Bid
        </p>
        <p className="font-black text-primary tracking-tighter leading-none text-2xl md:text-3xl">
          R {currentPrice.toLocaleString("en-ZA")}
        </p>
      </div>
      {!isClosed && (
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Ends In
          </p>
          <div className="text-sm font-bold">
            <CountdownTimer endTime={endTime} />
          </div>
        </div>
      )}
    </div>
  );
}
