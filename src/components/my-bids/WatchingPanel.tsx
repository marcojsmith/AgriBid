import { useRef } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";

import { LotCard } from "@/components/ds/LotCard";
import type { ReserveState } from "@/components/ds/ReservePill";
import { showToast } from "@/components/ds/showToast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/useNow";
import { formatRemaining } from "@/lib/countdown";
import { watchedCardState } from "@/lib/myBids";
import { getErrorMessage } from "@/lib/utils";

import { AlertsSummary } from "./AlertsSummary";
import { TabEmpty } from "./TabEmpty";
import type { WatchedLot } from "./types";

/** Lots loaded per page of the Watching tab. */
const PAGE_SIZE = 12;

/**
 * Maps the server's reserve state to the pill's.
 *
 * @param state - `none`, `applies`, `met` or `not_met`
 * @returns The pill state
 */
function reserveOf(state: WatchedLot["reserveState"]): ReserveState {
  return state === "not_met" ? "not-met" : state;
}

/**
 * The Watching tab: a line saying lots you bid on are added here, the alerts
 * row (phones; desktop has it in the side column) and the watched lots as
 * cards with a filled heart that stops watching. Loads more on request.
 *
 * @returns The panel contents
 */
export function WatchingPanel() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.watchlist.getWatchedLots,
    {},
    { initialNumItems: PAGE_SIZE }
  );
  const toggle = useMutation(api.watchlist.toggleWatchlist);
  const now = useNow();

  // The toggle flips the watch, so a second tap while the first is in flight
  // would watch the lot again. Taps on a lot already being updated are ignored.
  const pending = useRef(new Set<WatchedLot["_id"]>());
  const unwatch = (lotId: WatchedLot["_id"]) => {
    if (pending.current.has(lotId)) return;
    pending.current.add(lotId);
    toggle({ lotId })
      .catch((err: unknown) => {
        showToast(
          getErrorMessage(err, "Couldn't update your watchlist."),
          "error"
        );
      })
      .finally(() => {
        pending.current.delete(lotId);
      });
  };

  if (status === "LoadingFirstPage") {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Lots you bid on are added here.
      </p>
      <div className="border-y border-border py-1 lg:hidden">
        <AlertsSummary />
      </div>
      {results.length === 0 ? (
        <TabEmpty
          title="No watched lots"
          text="Tap the heart on a lot to watch it."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3">
          {results.map((lot) => {
            const { state, price } = watchedCardState(lot);
            const end = lot.extendedEndTime ?? lot.auctionEndTime;
            const open = state === "open" || state === "current-bid";
            return (
              <li key={lot._id}>
                <LotCard
                  lot={{
                    number: lot.lotNumber ?? "–",
                    title: lot.title,
                    href: `/auction/${lot._id}`,
                    photoSrc: lot.images.front,
                    year: lot.year,
                    hours: lot.operatingHours,
                    town: lot.location,
                  }}
                  state={state}
                  price={price}
                  reserve={open ? reserveOf(lot.reserveState) : undefined}
                  closesIn={
                    open && end !== undefined && end > now
                      ? formatRemaining(end - now)
                      : undefined
                  }
                  watching
                  alwaysShowWatch
                  onToggleWatch={() => {
                    unwatch(lot._id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => {
              loadMore(PAGE_SIZE);
            }}
          >
            {status === "LoadingMore" ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
