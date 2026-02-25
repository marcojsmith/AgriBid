// app/src/components/auction/AuctionCardThumbnail.tsx
import { Heart } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "../CountdownTimer";

interface AuctionCardThumbnailProps {
  primaryImage: string | undefined;
  title: string;
  isCompact: boolean;
  isWatched: boolean | undefined;
  onWatchlistToggle: (e: React.MouseEvent) => Promise<void>;
  endTime?: number;
  isClosed: boolean;
}

/**
 * Render a responsive auction thumbnail containing an image or placeholder, a watchlist toggle and an optional countdown.
 *
 * @param primaryImage - URL of the primary image; if undefined a placeholder is shown
 * @param title - Title used for the image alt text
 * @param isCompact - When true, render the compact layout (fixed width and inline countdown)
 * @param isWatched - Whether the item is currently on the user's watchlist
 * @param onWatchlistToggle - Click handler invoked when the watchlist (heart) button is pressed
 * @param endTime - End timestamp in milliseconds since the Unix epoch used by the countdown display
 * @param isClosed - Whether the auction is closed; when true the countdown is hidden
 * @returns The JSX element representing the auction thumbnail
 */
export function AuctionCardThumbnail({
  primaryImage,
  title,
  isCompact,
  isWatched,
  onWatchlistToggle,
  endTime,
  isClosed,
}: AuctionCardThumbnailProps) {
  return (
    <div
      className={cn(
        "shrink-0 flex flex-col",
        isCompact ? "w-[120px] sm:w-[160px] md:w-[180px]" : "w-full"
      )}
    >
      <div
        className={cn(
          "bg-muted flex items-center justify-center relative overflow-hidden",
          isCompact ? "flex-1 border-r" : "aspect-video"
        )}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center">
            <span className={isCompact ? "text-2xl" : "text-4xl"}>🚜</span>
            <span
              className={cn(
                "italic text-center px-2",
                isCompact ? "text-[8px]" : "text-xs mt-2"
              )}
            >
              Image Pending
            </span>
          </div>
        )}

        {/* Watchlist Heart Button (Top Left) */}
        <div
          className={cn(
            "absolute top-1.5 left-1.5",
            !isCompact && "top-3 left-3"
          )}
        >
          <Button
            variant="secondary"
            size="icon"
            aria-label={
              isWatched ? "Remove from watchlist" : "Add to watchlist"
            }
            aria-pressed={!!isWatched}
            className={cn(
              "rounded-full shadow-md bg-background/80 backdrop-blur hover:bg-background transition-all",
              isCompact ? "h-7 w-7" : "h-9 w-9",
              isWatched ? "text-red-500" : "text-zinc-500"
            )}
            onClick={onWatchlistToggle}
          >
            <Heart
              className={cn(
                isCompact ? "h-3.5 w-3.5" : "h-5 w-5",
                isWatched && "fill-current"
              )}
            />
          </Button>
        </div>
      </div>

      {/* Timer - Under Image */}
      {isCompact && !isClosed && (
        <div className="bg-muted/30 flex items-center justify-center px-2 border-r h-12 border-t">
          <div className="font-black whitespace-nowrap leading-none text-sm sm:text-base">
            <CountdownTimer endTime={endTime} />
          </div>
        </div>
      )}
    </div>
  );
}
