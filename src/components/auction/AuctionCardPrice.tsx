// app/src/components/auction/AuctionCardPrice.tsx
import { CountdownTimer } from "@/components/CountdownTimer";
import { formatCurrency } from "@/lib/currency";
import { usePriceHighlight } from "@/hooks/usePriceHighlight";

interface AuctionCardPriceProps {
  currentPrice: number;
  endTime?: number;
  isCompact: boolean;
  isClosed: boolean;
  startTime?: number;
  isNotStarted?: boolean;
}

/**
 * Display the current bid and auction countdown, or render nothing in compact mode.
 *
 * The row stacks by default and only switches to a side-by-side layout once the
 * container is at least 24rem wide, so the layout follows the card width rather
 * than the viewport — a 2/3-column lots grid makes cards far narrower than the
 * viewport. An ancestor (the card's content wrapper) must therefore be marked
 * `@container`, otherwise every `@[...]` variant here silently never applies.
 *
 * @param props - Component props
 * @param props.currentPrice - The current bid amount in rand
 * @param props.endTime - Optional auction end timestamp in milliseconds used to initialise the countdown
 * @param props.isCompact - If `true`, nothing is rendered
 * @param props.isClosed - If `true`, the countdown is hidden (auction is sold or unsold)
 * @param props.startTime - Scheduled start timestamp in milliseconds; used for the countdown when the auction hasn't started
 * @param props.isNotStarted - If `true`, shows a "Starts in" countdown to `startTime` instead of "Ends in"
 * @returns The rendered price-and-countdown markup, or `null` when `isCompact` is `true`.
 */
export function AuctionCardPrice({
  currentPrice,
  endTime,
  isCompact,
  isClosed,
  startTime,
  isNotStarted = false,
}: AuctionCardPriceProps) {
  const isHighlighted = usePriceHighlight(currentPrice);

  if (isCompact) return null;

  return (
    <div className="flex flex-col items-start gap-1 mt-2 @[24rem]:mt-4 @[24rem]:flex-row @[24rem]:items-end @[24rem]:justify-between">
      <div
        className={`min-w-0 rounded-lg p-2 -mx-2 border transition-colors duration-700 ${
          isHighlighted
            ? "bg-success/10 border-success/30"
            : "border-transparent"
        }`}
      >
        <p className="text-muted-foreground font-medium text-xs">
          {isNotStarted ? "Starting price" : "Current bid"}
        </p>
        <p className="font-bold tabular-nums text-primary tracking-tight leading-none whitespace-nowrap text-xl @[18rem]:text-2xl @[24rem]:text-3xl">
          {formatCurrency(currentPrice)}
        </p>
      </div>
      {!isClosed && (
        <div className="min-w-0 whitespace-nowrap @[24rem]:text-right">
          <p
            className={`text-xs font-medium ${isNotStarted ? "text-warning" : "text-muted-foreground"}`}
          >
            {isNotStarted ? "Starts in" : "Ends in"}
          </p>
          <div className="text-sm font-bold">
            <CountdownTimer endTime={isNotStarted ? startTime : endTime} />
          </div>
        </div>
      )}
    </div>
  );
}
