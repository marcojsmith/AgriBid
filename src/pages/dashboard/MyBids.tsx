import { useCallback, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  usePaginatedQuery,
  useQuery,
  type PaginationStatus,
} from "convex/react";
import { api } from "convex/_generated/api";

import { Banner } from "@/components/ds/Banner";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BidRow } from "@/components/my-bids/BidRow";
import { LostRow } from "@/components/my-bids/LostRow";
import { MyBidsTabs } from "@/components/my-bids/MyBidsTabs";
import { RegistrationBanner } from "@/components/my-bids/RegistrationBanner";
import { RegistrationRail } from "@/components/my-bids/RegistrationRail";
import { TabEmpty } from "@/components/my-bids/TabEmpty";
import type { MyBidRow, WonLotRow } from "@/components/my-bids/types";
import { WatchingPanel } from "@/components/my-bids/WatchingPanel";
import { WonRow } from "@/components/my-bids/WonRow";
import { useNow } from "@/hooks/useNow";
import { useVatRate } from "@/hooks/useVatRate";
import { formatSastDate } from "@/lib/dates";
import {
  defaultTab,
  formatShortDay,
  panelId,
  paymentBanner,
  parseTab,
  rowClosesAt,
  tabId,
  type MyBidsTab,
} from "@/lib/myBids";

/** Won lots loaded per page. */
const WON_PAGE_SIZE = 10;

/**
 * A section heading with an optional note on the right ("Live", "Closes Wed
 * 25 Nov, 11:00").
 *
 * @param props - Component props
 * @param props.title - The heading
 * @param props.note - Right-aligned note
 * @param props.id - Heading id, for the list it names
 * @returns The heading row
 */
function GroupHeading({
  title,
  note,
  id,
}: {
  title: string;
  note?: string;
  id: string;
}) {
  return (
    <div className="mt-6 flex items-baseline justify-between gap-3 first:mt-2">
      <h2
        id={id}
        className="font-display text-[22px] leading-tight font-semibold"
      >
        {title}
      </h2>
      {note ? (
        <p className="text-right text-sm text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * The note beside "Live": the sale's close time when every lot closes
 * together, "Soft close" when a lot has been extended, else none.
 *
 * @param rows - The open rows
 * @param now - Current time (ms)
 * @returns The note
 */
function liveNote(rows: readonly MyBidRow[], now: number): string | undefined {
  if (
    rows.some(
      (row) => row.isExtended === true && (row.extendedEndTime ?? 0) > now
    )
  ) {
    return "Soft close";
  }
  const ends = new Set(rows.map(rowClosesAt));
  const [only] = ends;
  return ends.size === 1 && only !== undefined
    ? `Closes ${formatSastDate(only)}`
    : undefined;
}

/**
 * The note beside "With the seller": the day the sale closed, when it is the
 * same for every lot.
 *
 * @param rows - The rows with the seller
 * @returns The note
 */
function sellerNote(rows: readonly MyBidRow[]): string | undefined {
  const ends = new Set(rows.map(rowClosesAt));
  const [only] = ends;
  return ends.size === 1 && only !== undefined
    ? `Closed ${formatShortDay(only)}`
    : undefined;
}

/**
 * A skeleton shaped like a row, for the loading state of a tab.
 *
 * @returns Three placeholder rows
 */
function RowSkeletons() {
  return (
    <div aria-hidden="true" className="space-y-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-3 border-b border-border py-4">
          <Skeleton className="h-[72px] w-24 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The Bidding tab: lots open for bids ("Live"), then lots with the seller
 * ("With the seller").
 *
 * @param props - Component props
 * @param props.rows - The Bidding rows
 * @param props.vatRatePct - VAT rate in percent
 * @param props.canBid - Whether the buyer may bid
 * @returns The panel contents
 */
function BiddingPanel({
  rows,
  vatRatePct,
  canBid,
}: {
  rows: readonly MyBidRow[];
  vatRatePct: number | undefined;
  canBid: boolean;
}) {
  const now = useNow();
  const live = rows.filter((row) => row.status === "assigned");
  const withSeller = rows.filter((row) => row.status === "under_consideration");
  if (rows.length === 0) {
    return (
      <TabEmpty
        title="Nothing to bid on"
        text="Lots you bid on show here."
        browse
      />
    );
  }
  return (
    <>
      {live.length > 0 ? (
        <section aria-labelledby="my-bids-live">
          <GroupHeading
            id="my-bids-live"
            title="Live"
            note={liveNote(live, now)}
          />
          {live.map((row) => (
            <BidRow
              key={row._id}
              row={row}
              vatRatePct={vatRatePct}
              canBid={canBid}
            />
          ))}
        </section>
      ) : null}
      {withSeller.length > 0 ? (
        <section aria-labelledby="my-bids-seller">
          <GroupHeading
            id="my-bids-seller"
            title="With the seller"
            note={sellerNote(withSeller)}
          />
          {withSeller.map((row) => (
            <BidRow
              key={row._id}
              row={row}
              vatRatePct={vatRatePct}
              canBid={canBid}
            />
          ))}
        </section>
      ) : null}
    </>
  );
}

/**
 * The Won tab: the lots the buyer won, each with its payment. Legacy wins
 * without a payment record are not listed.
 *
 * @param props - Component props
 * @param props.rows - The won rows loaded so far
 * @param props.status - Pagination status
 * @param props.loadMore - Loads the next page
 * @returns The panel contents
 */
function WonPanel({
  rows,
  status,
  loadMore,
}: {
  rows: readonly WonLotRow[];
  status: PaginationStatus;
  loadMore: (n: number) => void;
}) {
  if (status === "LoadingFirstPage") return <RowSkeletons />;
  if (rows.length === 0) {
    return <TabEmpty title="No won lots yet" text="Lots you win show here." />;
  }
  return (
    <>
      {rows.map((row) => (
        <WonRow key={row.paymentId} row={row} />
      ))}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => {
              loadMore(WON_PAGE_SIZE);
            }}
          >
            {status === "LoadingMore" ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * The buyer's own page: Bidding, Won, Lost and Watching in tabs (kept in the
 * URL as `?tab=`). Above them: the payment banner on Won, and a registration
 * banner with its action while the buyer cannot bid yet. A new buyer with
 * nothing anywhere sees one empty state instead of the tabs. From `lg` a side
 * column shows registration and alerts.
 *
 * @returns The My bids page
 */
export default function MyBids() {
  const [params, setParams] = useSearchParams();
  const overview = useQuery(api.auctions.queries.getMyBidsOverview);
  const eligibility = useQuery(api.registration.getMyBidEligibility);
  const summary = useQuery(api.lotPayments.getMyPaymentSummary);
  const vatRatePct = useVatRate();
  const now = useNow();

  const explicit = parseTab(params.get("tab"));
  const ready =
    overview !== undefined &&
    (overview.counts.bidding > 0 || summary !== undefined);
  // The default tab is chosen once, when the data first arrives: later
  // changes (a payment claimed, a lot settled) must not move the buyer.
  const [chosen, setChosen] = useState<MyBidsTab | null>(null);
  if (chosen === null && overview !== undefined && ready) {
    setChosen(
      defaultTab({
        biddingCount: overview.counts.bidding,
        awaitingPayment: (summary?.awaitingCount ?? 0) > 0,
      })
    );
  }
  const tab: MyBidsTab = explicit ?? chosen ?? "bidding";

  const won = usePaginatedQuery(
    api.lotPayments.getMyWonLots,
    tab === "won" ? {} : "skip",
    { initialNumItems: WON_PAGE_SIZE }
  );

  const selectTab = useCallback(
    (next: MyBidsTab) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set("tab", next);
          return copy;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const pageHead = (
    <h1 className="font-display text-[28px] leading-tight font-semibold">
      My bids
    </h1>
  );

  if (overview === undefined || (explicit === null && !ready)) {
    return (
      <div className="mx-auto max-w-[1200px]">
        {pageHead}
        <div
          className="mt-4 space-y-4"
          role="status"
          aria-label="Loading my bids"
        >
          <Skeleton className="h-12 w-full lg:max-w-[520px]" />
          <RowSkeletons />
        </div>
      </div>
    );
  }

  const { counts } = overview;
  const brandNew =
    counts.bidding + counts.won + counts.lost + counts.watching === 0;
  const canBid = eligibility?.kind === "ok";
  const banner =
    tab === "won" ? paymentBanner(won.results, now, summary) : null;

  let panel: ReactNode;
  if (tab === "bidding") {
    panel = (
      <BiddingPanel
        rows={overview.bidding}
        vatRatePct={vatRatePct}
        canBid={canBid}
      />
    );
  } else if (tab === "won") {
    panel = (
      <WonPanel
        rows={won.results}
        status={won.status}
        loadMore={won.loadMore}
      />
    );
  } else if (tab === "lost") {
    panel =
      overview.lost.length === 0 ? (
        <TabEmpty title="No lost lots" text="Lots you did not win show here." />
      ) : (
        <>
          {overview.lost.map((row) => (
            <LostRow key={row._id} row={row} />
          ))}
          {overview.lost.length < counts.lost ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing your latest {overview.lost.length}.
            </p>
          ) : null}
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/auctions">
              See current auctions
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </>
      );
  } else {
    panel = <WatchingPanel />;
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {pageHead}
      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="min-w-0 space-y-4">
          {eligibility && eligibility.kind !== "ok" ? (
            <RegistrationBanner eligibility={eligibility} />
          ) : null}
          {banner ? <Banner kind={banner.kind}>{banner.text}</Banner> : null}
          {brandNew ? (
            <TabEmpty
              title="No bids yet"
              text={
                eligibility?.kind === "incomplete"
                  ? "You can watch lots now."
                  : "Lots you bid on show here."
              }
              browse
              primary={eligibility?.kind !== "incomplete"}
            />
          ) : (
            <>
              <MyBidsTabs value={tab} onChange={selectTab} counts={counts} />
              <div
                role="tabpanel"
                id={panelId(tab)}
                aria-labelledby={tabId(tab)}
                tabIndex={0}
              >
                <RouteErrorBoundary>{panel}</RouteErrorBoundary>
              </div>
            </>
          )}
        </div>
        <RegistrationRail />
      </div>
    </div>
  );
}
