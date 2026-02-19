// app/src/components/auction/AuctionCardPrice.tsx
import { CountdownTimer } from "../CountdownTimer";

interface AuctionCardPriceProps {
  currentPrice: number;
  endTime: number;
  isCompact: boolean;
}

/**
 * Render the current bid and remaining auction time unless the component is in compact mode.
 *
 * @param currentPrice - The current bid amount displayed in South African rand; formatted with `toLocaleString("en-ZA")`.
 * @param endTime - The auction end timestamp in milliseconds since the Unix epoch used by the countdown.
 * @param isCompact - When `true`, the component renders nothing.
 * @returns The price-and-countdown markup, or `null` when `isCompact` is `true`.
 */
export function AuctionCardPrice({
  currentPrice,
  endTime,
  isCompact,
}: AuctionCardPriceProps) {
  if (isCompact) return null;

  return (
    <div className="flex justify-between items-end mt-2 md:mt-4">
      <div>
        <p className="text-muted-foreground uppercase font-black tracking-widest text-[10px] md:text-xs">
          Current Bid
        </p>
        <p className="font-black text-primary tracking-tighter leading-none text-2xl md:text-3xl">
          R {currentPrice.toLocaleString("en-ZA")}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
          Ends In
        </p>
        <div className="text-sm font-bold">
          <CountdownTimer endTime={endTime} />
        </div>
      </div>
    </div>
  );
}