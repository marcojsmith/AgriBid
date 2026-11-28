import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConvexProviderWithAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";

import { BrandingProvider } from "@/contexts/BrandingProvider";
import {
  fixtureLotId,
  makeBidRow,
  makeWatchedLot,
  makeWonRow,
} from "@/components/my-bids/fixtures";
import MyBids from "@/pages/dashboard/MyBids";

import { fixtureClient, useFixtureAuth, type Answers } from "./fixtureClient";

const HOUR = 3_600_000;
const MIN = 60_000;

/** One frame of the mockup: a name, the URL and what the queries answer. */
interface Frame {
  id: string;
  label: string;
  url: string;
  answers: Answers;
}

/**
 * Names a query for the answers map.
 *
 * @param ref - The query reference
 * @returns Its function name
 */
const nameOf = (ref: FunctionReference<"query">): string =>
  getFunctionName(ref);

/**
 * The frames of `mybids-r2.html`, with data relative to now so every closing
 * time and deadline reads as in the mockup.
 *
 * @param now - The clock (ms)
 * @returns The frames
 */
function buildFrames(now: number): Frame[] {
  const outbid = makeBidRow(now);
  const leadingDeere = makeBidRow(now, {
    _id: fixtureLotId("deere8335"),
    title: "John Deere 8335R",
    lotNumber: 2,
    year: 2013,
    operatingHours: 9500,
    location: "Wolmaransstad",
    myHighestBid: 600_000,
    currentPrice: 600_000,
    isWinning: true,
  });
  const leadingLandini = makeBidRow(now, {
    _id: fixtureLotId("landini"),
    title: "Landini Landpower 135",
    lotNumber: 4,
    year: 2011,
    operatingHours: 6500,
    location: "Jansenville",
    myHighestBid: 100_000,
    currentPrice: 100_000,
    isWinning: true,
  });
  const closedAt = now - 20 * HOUR;
  const withSeller = [
    makeBidRow(now, {
      _id: fixtureLotId("case4240"),
      title: "Case 4240",
      lotNumber: 3,
      year: 0,
      operatingHours: 0,
      location: "Malmesbury",
      status: "under_consideration",
      isLeadingConsideration: true,
      reserveState: "not_met",
      myHighestBid: 64_500,
      currentPrice: 64_500,
      considerationDeadline: now + 26 * HOUR,
      auctionEndTime: closedAt,
    }),
    makeBidRow(now, {
      _id: fixtureLotId("mf455"),
      title: "Massey Ferguson 455 Xtra 4x4",
      lotNumber: 4,
      year: 0,
      operatingHours: 0,
      location: "Pretoria",
      status: "under_consideration",
      isLeadingConsideration: false,
      myHighestBid: 118_000,
      currentPrice: 124_000,
      auctionEndTime: closedAt,
    }),
  ];
  const lost = [
    makeBidRow(now, {
      _id: fixtureLotId("ford5000"),
      title: "Ford 5000",
      lotNumber: 2,
      year: 0,
      operatingHours: 0,
      location: "Pretoria",
      status: "sold",
      myHighestBid: 58_000,
      currentPrice: 61_000,
      auctionEndTime: closedAt,
    }),
    makeBidRow(now, {
      _id: fixtureLotId("deere5700"),
      title: "John Deere 5700 4x4 with loader",
      lotNumber: 5,
      year: 0,
      operatingHours: 0,
      location: "Cradock",
      status: "unsold",
      reserveState: "not_met",
      myHighestBid: 62_000,
      currentPrice: 62_000,
      auctionEndTime: closedAt,
    }),
  ];
  const watched = [
    makeWatchedLot(now),
    makeWatchedLot(now, {
      _id: fixtureLotId("casejx"),
      title: "Case JX45T",
      year: 2021,
      location: "Heidelberg",
      lotNumber: 8,
      startingPrice: 95_000,
      currentPrice: 95_000,
    }),
    makeWatchedLot(now, {
      _id: fixtureLotId("solis"),
      title: "Landini Solis 75",
      year: 2023,
      operatingHours: 570,
      location: "Pretoria",
      lotNumber: 9,
      reserveState: "none",
      startingPrice: 90_000,
      currentPrice: 90_000,
    }),
    makeWatchedLot(now, {
      _id: fixtureLotId("harrow"),
      title: "Hydraulic Disc Harrow",
      year: 0,
      location: "Kestell",
      lotNumber: 12,
      reserveState: "none",
      startingPrice: 17_000,
      currentPrice: 17_000,
    }),
  ];
  const counts = { bidding: 5, won: 1, lost: 2, watching: 4 };
  const overview = (bidding: ReturnType<typeof makeBidRow>[]) => ({
    bidding,
    lost,
    counts,
  });
  const base: Answers = {
    [nameOf(api.registration.getMyBidEligibility)]: { kind: "ok" },
    [nameOf(api.lotPayments.getMyPaymentSummary)]: {
      unpaidCount: 1,
      awaitingCount: 1,
      claimedCount: 0,
      nextPayBy: now + 26 * HOUR,
      nextAmountDue: 113_496,
      nextLotId: fixtureLotId("jcb3cx"),
    },
    [nameOf(api.admin.getVatRate)]: { vatRatePct: 15 },
    [nameOf(api.userPreferences.getMyPreferences)]: null,
    [nameOf(api.admin.getBusinessInfo)]: { whatsapp: "+27 83 700 0000" },
    [nameOf(api.registration.getMyRegistration)]: {
      eligibility: { kind: "ok" },
      details: {
        idType: "sa_id",
        fullName: "Thandi Naidoo",
        phoneNumber: "0825550188",
        idNumber: "9001015800087",
        streetAddress: "1 Plaas Road",
        town: "Malmesbury",
        postalCode: "7300",
      },
      documents: [],
      deposit: {
        reference: "AB-7K3F2",
        status: "received",
        amount: 5000,
        receivedAt: now - 3 * 24 * HOUR,
        refundableAmount: 5000,
      },
      depositSettings: { enabled: true, amount: 5000, refundDays: 3 },
      submittedAt: now - 4 * 24 * HOUR,
    },
    [nameOf(api.watchlist.getWatchedLots)]: watched,
    [nameOf(api.admin.platformSettings.getDepositBankDetails)]: {
      bank: "FNB",
      accountName: "AgriBid (Pty) Ltd",
      accountNumber: "62000000001",
      branchCode: "250655",
    },
  };
  const live = [outbid, leadingDeere, leadingLandini];
  const soon = (endsIn: number) =>
    live.map((row) => ({ ...row, auctionEndTime: now + endsIn }));
  const overviewKey = nameOf(api.auctions.queries.getMyBidsOverview);
  const wonKey = nameOf(api.lotPayments.getMyWonLots);
  const paid = makeWonRow(now, {
    status: "confirmed",
    paidClaimedAt: now - 19 * HOUR,
    confirmedAt: now - 19 * HOUR,
    collectBy: now + 6 * 24 * HOUR,
    amountDue: 113_496,
  });
  const collectionKey = nameOf(api.lotPayments.getMyCollectionDetails);
  const empty = {
    bidding: [],
    lost: [],
    counts: { bidding: 0, won: 0, lost: 0, watching: 0 },
  };
  return [
    {
      id: "bidding",
      label: "Bidding (light and dark: use the theme button)",
      url: "/dashboard/bids?tab=bidding",
      answers: {
        ...base,
        [overviewKey]: overview([...live, ...withSeller]),
      },
    },
    {
      id: "closing",
      label: "Bidding, closing in 40 minutes (amber)",
      url: "/dashboard/bids?tab=bidding",
      answers: { ...base, [overviewKey]: overview(soon(40 * MIN)) },
    },
    {
      id: "extended",
      label: "Bidding, soft close (red, +2 min)",
      url: "/dashboard/bids?tab=bidding",
      answers: {
        ...base,
        [overviewKey]: overview([
          {
            ...outbid,
            isExtended: true,
            currentPrice: 428_000,
            nextMinBid: 431_500,
            extendedEndTime: now + 112_000,
          },
        ]),
      },
    },
    {
      id: "won",
      label: "Won, awaiting payment (open Pay by EFT for the sheet)",
      url: "/dashboard/bids?tab=won",
      answers: {
        ...base,
        [overviewKey]: overview([...live, ...withSeller]),
        [wonKey]: [makeWonRow(now)],
      },
    },
    {
      id: "won-paid",
      label: "Won, payment confirmed (collection card)",
      url: "/dashboard/bids?tab=won",
      answers: {
        ...base,
        [overviewKey]: overview([...live, ...withSeller]),
        [wonKey]: [paid],
        [collectionKey]: {
          sellerName: "Thandi N.",
          sellerPhone: "082 555 0188",
          collectionAddress: "Farm Rietfontein, Mthatha, Eastern Cape",
          collectBy: now + 6 * 24 * HOUR,
        },
      },
    },
    {
      id: "lost",
      label: "Lost",
      url: "/dashboard/bids?tab=lost",
      answers: { ...base, [overviewKey]: overview([...live, ...withSeller]) },
    },
    {
      id: "watching",
      label: "Watching",
      url: "/dashboard/bids?tab=watching",
      answers: { ...base, [overviewKey]: overview([...live, ...withSeller]) },
    },
    {
      id: "empty",
      label: "Empty: a new buyer",
      url: "/dashboard/bids",
      answers: { ...base, [overviewKey]: empty },
    },
    {
      id: "reg-unfinished",
      label: "Registration unfinished (and nothing yet)",
      url: "/dashboard/bids",
      answers: {
        ...base,
        [overviewKey]: empty,
        [nameOf(api.registration.getMyBidEligibility)]: {
          kind: "incomplete",
          step: 2,
          totalSteps: 4,
        },
      },
    },
    {
      id: "reg-review",
      label: "Documents under review (watching only)",
      url: "/dashboard/bids?tab=watching",
      answers: {
        ...base,
        [overviewKey]: {
          bidding: [],
          lost: [],
          counts: { bidding: 0, won: 0, lost: 0, watching: 2 },
        },
        [nameOf(api.registration.getMyBidEligibility)]: {
          kind: "under_review",
          depositReceived: false,
        },
        [nameOf(api.watchlist.getWatchedLots)]: watched.slice(0, 2),
      },
    },
    {
      id: "reg-deposit",
      label: "Deposit due",
      url: "/dashboard/bids?tab=lost",
      answers: {
        ...base,
        [overviewKey]: overview([]),
        [nameOf(api.registration.getMyBidEligibility)]: {
          kind: "deposit_due",
          amount: 5000,
        },
      },
    },
  ];
}

/**
 * One frame: the real My bids page inside a fixture client and its own
 * in-memory router, so no frame touches the URL or any backend.
 *
 * @param props - Component props
 * @param props.frame - The frame to render
 * @returns The titled frame
 */
function FrameView({ frame }: { frame: Frame }): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    // Its own React root, so the frame's router does not nest inside the
    // app's router (which React Router forbids).
    const el = document.createElement("div");
    node.appendChild(el);
    const root = createRoot(el);
    root.render(
      <ConvexProviderWithAuth
        client={fixtureClient(frame.answers)}
        useAuth={useFixtureAuth}
      >
        <BrandingProvider>
          <MemoryRouter initialEntries={[frame.url]}>
            <MyBids />
          </MemoryRouter>
        </BrandingProvider>
      </ConvexProviderWithAuth>
    );
    return () => {
      // Unmount after the current render pass.
      setTimeout(() => {
        root.unmount();
        el.remove();
      }, 0);
    };
  }, [frame]);
  return (
    <section
      aria-label={frame.id}
      className="rounded-md border border-border p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        {frame.id}: {frame.label}
      </h3>
      <div ref={host} />
    </section>
  );
}

/**
 * The "My bids" section of the design-system page: every state of the real
 * page, rendered with fixture data (the frames of `mybids-r2`). Open the
 * sheets by tapping "Bid R 421 000" and "Pay by EFT".
 *
 * @returns The frames
 */
export function DesignSystemMyBids() {
  // The clock is fixed at mount so the frames stay stable while the page ticks.
  const [frames] = useState(() => buildFrames(Date.now()));
  return (
    <div className="space-y-8">
      {frames.map((frame) => (
        <FrameView key={frame.id} frame={frame} />
      ))}
    </div>
  );
}
