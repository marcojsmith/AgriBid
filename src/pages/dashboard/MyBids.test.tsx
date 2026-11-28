import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { getFunctionName, type FunctionReference } from "convex/server";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fixtureLotId,
  makeBidRow,
  makeWatchedLot,
  makeWonRow,
} from "@/components/my-bids/fixtures";
import {
  makeRegistration,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import MyBids from "./MyBids";

const pages = vi.hoisted(
  (): {
    value: Record<string, { results: unknown[]; status: string } | undefined>;
  } => ({ value: {} })
);
vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  const { getFunctionName: nameOf } = await import("convex/server");
  return {
    useQuery: t.mockUseQuery,
    useMutation: t.mockUseMutation,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => {
      if (args === "skip") {
        return { results: [], status: "LoadingFirstPage", loadMore: vi.fn() };
      }
      const page = pages.value[nameOf(ref)];
      return {
        results: page?.results ?? [],
        status: page?.status ?? "Exhausted",
        loadMore: vi.fn(),
      };
    },
  };
});
vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ businessInfo: {} }),
}));

const NOW = Date.now();
const COUNTS = { bidding: 2, won: 1, lost: 1, watching: 1 };

/**
 * Shows the current URL so tests can see the tab being kept in it.
 *
 * @returns The path and query
 */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

/**
 * Renders the page at a URL.
 *
 * @param entry - The URL
 */
function renderPage(entry = "/dashboard/bids") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <MyBids />
      <Where />
    </MemoryRouter>
  );
}

/**
 * Registers the queries of a buyer with data in every tab.
 *
 * @param overrides - Overview fields to replace
 * @param overrides.bidding - Bidding rows
 * @param overrides.lost - Lost rows
 * @param overrides.counts - Tab counts
 */
function seed(
  overrides: {
    bidding?: ReturnType<typeof makeBidRow>[];
    lost?: ReturnType<typeof makeBidRow>[];
    counts?: typeof COUNTS;
  } = {}
) {
  setQuery(api.auctions.queries.getMyBidsOverview, {
    bidding: overrides.bidding ?? [
      makeBidRow(NOW),
      makeBidRow(NOW, {
        _id: fixtureLotId("case4240"),
        title: "Case 4240",
        status: "under_consideration",
        isLeadingConsideration: true,
        considerationDeadline: NOW + 24 * 3_600_000,
        auctionEndTime: NOW - 3_600_000,
      }),
    ],
    lost: overrides.lost ?? [
      makeBidRow(NOW, {
        _id: fixtureLotId("ford"),
        title: "Ford 5000",
        status: "sold",
        auctionEndTime: NOW - 20 * 3_600_000,
      }),
    ],
    counts: overrides.counts ?? COUNTS,
  });
  setQuery(api.registration.getMyBidEligibility, { kind: "ok" });
  setQuery(api.lotPayments.getMyPaymentSummary, {
    unpaidCount: 0,
    awaitingCount: 0,
    claimedCount: 0,
    nextPayBy: null,
    nextAmountDue: null,
    nextLotId: null,
  });
  setQuery(api.admin.getVatRate, { vatRatePct: 15 });
  setQuery(api.registration.getMyRegistration, makeRegistration());
  setQuery(api.userPreferences.getMyPreferences, null);
}

describe("MyBids", () => {
  beforeEach(() => {
    resetConvexState();
    pages.value = {};
  });

  it("shows a loading state until the overview arrives", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "My bids", level: 1 })
    ).toBeVisible();
    expect(
      screen.getByRole("status", { name: "Loading my bids" })
    ).toBeVisible();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("opens on Bidding with counts, a live group and a with-the-seller group", () => {
    seed();
    renderPage();
    expect(screen.getByRole("tab", { name: /^Bidding/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: /^Won/ }).textContent).toContain(
      "1"
    );
    expect(screen.getByRole("heading", { name: "Live" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "With the seller" })
    ).toBeVisible();
    expect(screen.getByText("New Holland T6070")).toBeVisible();
    expect(screen.getByText("Case 4240")).toBeVisible();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "my-bids-tab-bidding"
    );
    expect(screen.getByRole("button", { name: /Bid R/ })).toBeVisible();
  });

  it("keeps the tab in the URL and shows the Lost tab", () => {
    seed();
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /^Lost/ }));
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/dashboard/bids?tab=lost"
    );
    expect(screen.getByText("Ford 5000")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "See current auctions" })
    ).toHaveAttribute("href", "/auctions");
  });

  it("reads the tab from the URL and ignores an unknown one", () => {
    seed();
    renderPage("/dashboard/bids?tab=nonsense");
    expect(screen.getByRole("tab", { name: /^Bidding/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("shows the Watching tab", () => {
    seed();
    pages.value[getFunctionName(api.watchlist.getWatchedLots)] = {
      results: [makeWatchedLot(NOW)],
      status: "Exhausted",
    };
    renderPage("/dashboard/bids?tab=watching");
    expect(screen.getByText("John Deere 8370RT")).toBeVisible();
    expect(screen.getByText("Lots you bid on are added here.")).toBeVisible();
  });

  it("shows the Won tab with the payment banner above the tabs", () => {
    seed();
    setQuery(api.lotPayments.getMyPaymentSummary, {
      unpaidCount: 1,
      awaitingCount: 1,
      claimedCount: 0,
      nextPayBy: NOW + 3_600_000,
      nextAmountDue: 113_496,
      nextLotId: fixtureLotId("jcb3cx"),
    });
    pages.value[getFunctionName(api.lotPayments.getMyWonLots)] = {
      results: [makeWonRow(NOW)],
      status: "Exhausted",
    };
    renderPage("/dashboard/bids?tab=won");
    expect(screen.getByText(/^Pay R.113.496 by /)).toBeVisible();
    expect(screen.getByRole("button", { name: "Pay by EFT" })).toBeVisible();
  });

  it("shows loading rows, then an empty Won tab", () => {
    seed();
    pages.value[getFunctionName(api.lotPayments.getMyWonLots)] = {
      results: [],
      status: "LoadingFirstPage",
    };
    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard/bids?tab=won"]}>
        <MyBids />
      </MemoryRouter>
    );
    expect(screen.queryByText("No won lots yet")).toBeNull();
    unmount();
    pages.value[getFunctionName(api.lotPayments.getMyWonLots)] = {
      results: [],
      status: "Exhausted",
    };
    renderPage("/dashboard/bids?tab=won");
    expect(screen.getByText("No won lots yet")).toBeVisible();
  });

  it("opens on Won when nothing is being bid on and a lot awaits payment", () => {
    seed({ bidding: [], counts: { ...COUNTS, bidding: 0 } });
    setQuery(api.lotPayments.getMyPaymentSummary, {
      unpaidCount: 1,
      awaitingCount: 1,
      claimedCount: 0,
      nextPayBy: NOW,
      nextAmountDue: 113_496,
      nextLotId: fixtureLotId("jcb3cx"),
    });
    pages.value[getFunctionName(api.lotPayments.getMyWonLots)] = {
      results: [makeWonRow(NOW)],
      status: "Exhausted",
    };
    renderPage();
    expect(screen.getByRole("tab", { name: /^Won/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("stays on Bidding when nothing is being bid on and nothing awaits payment", () => {
    seed({ bidding: [], counts: { ...COUNTS, bidding: 0 } });
    renderPage();
    expect(screen.getByRole("tab", { name: /^Bidding/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Nothing to bid on")).toBeVisible();
  });

  it("waits for the payment summary before choosing a default tab", () => {
    seed({ bidding: [], counts: { ...COUNTS, bidding: 0 } });
    setQuery(api.lotPayments.getMyPaymentSummary, undefined);
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading my bids" })
    ).toBeVisible();
  });

  it("does not move the buyer to another tab when the payment summary changes", () => {
    seed({ bidding: [], counts: { ...COUNTS, bidding: 0 } });
    const awaiting = {
      unpaidCount: 1,
      awaitingCount: 1,
      claimedCount: 0,
      nextPayBy: NOW,
      nextAmountDue: 113_496,
      nextLotId: fixtureLotId("jcb3cx"),
    };
    setQuery(api.lotPayments.getMyPaymentSummary, awaiting);
    const view = render(
      <MemoryRouter initialEntries={["/dashboard/bids"]}>
        <MyBids />
      </MemoryRouter>
    );
    expect(screen.getByRole("tab", { name: /^Won/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    setQuery(api.lotPayments.getMyPaymentSummary, {
      ...awaiting,
      awaitingCount: 0,
      claimedCount: 1,
    });
    view.rerender(
      <MemoryRouter initialEntries={["/dashboard/bids"]}>
        <MyBids />
      </MemoryRouter>
    );
    expect(screen.getByRole("tab", { name: /^Won/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("takes the Won banner from the payment summary, not only the loaded page", () => {
    seed();
    setQuery(api.lotPayments.getMyPaymentSummary, {
      unpaidCount: 3,
      awaitingCount: 3,
      claimedCount: 0,
      nextPayBy: Date.UTC(2026, 10, 26, 9, 0),
      nextAmountDue: 1000,
      nextLotId: fixtureLotId("jcb3cx"),
    });
    pages.value[getFunctionName(api.lotPayments.getMyWonLots)] = {
      results: [],
      status: "Exhausted",
    };
    renderPage("/dashboard/bids?tab=won");
    expect(
      screen.getByText("3 lots to pay. First due Thu 26 Nov, 11:00")
    ).toBeVisible();
  });

  it("says how many lost lots are shown when there are more", () => {
    seed({ counts: { ...COUNTS, lost: 60 } });
    renderPage("/dashboard/bids?tab=lost");
    expect(screen.getByText("Showing your latest 1.")).toBeVisible();
  });

  it("shows an empty Lost tab", () => {
    seed({ lost: [], counts: { ...COUNTS, lost: 0 } });
    renderPage("/dashboard/bids?tab=lost");
    expect(screen.getByText("No lost lots")).toBeVisible();
  });

  it("shows one empty state, not the tabs, to a new buyer", () => {
    seed({
      bidding: [],
      lost: [],
      counts: { bidding: 0, won: 0, lost: 0, watching: 0 },
    });
    renderPage();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("No bids yet")).toBeVisible();
    expect(screen.getByText("Lots you bid on show here.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse auctions" })).toBeVisible();
  });

  it("tells an unfinished buyer they can still watch lots", () => {
    seed({
      bidding: [],
      lost: [],
      counts: { bidding: 0, won: 0, lost: 0, watching: 0 },
    });
    setQuery(api.registration.getMyBidEligibility, {
      kind: "incomplete",
      step: 2,
      totalSteps: 4,
    });
    renderPage();
    expect(
      screen.getByText("Finish registration to bid. Step 2 of 4.")
    ).toBeVisible();
    expect(screen.getByText("You can watch lots now.")).toBeVisible();
  });

  it("hides the bid button while the buyer cannot bid and shows the banner", () => {
    seed();
    setQuery(api.registration.getMyBidEligibility, {
      kind: "deposit_due",
      amount: 5000,
    });
    renderPage();
    expect(screen.getByText(/Pay your R.5.000 deposit to bid\./)).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Bid R/ })).toBeNull();
  });

  it("shows nothing about registration while eligibility loads", () => {
    seed();
    setQuery(api.registration.getMyBidEligibility, undefined);
    renderPage();
    expect(screen.queryByRole("region", { name: "Registration" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bid R/ })).toBeNull();
  });

  it("notes a soft close and the shared closing time of live lots", () => {
    seed({
      bidding: [
        makeBidRow(NOW, {
          isExtended: true,
          extendedEndTime: NOW + 100_000,
        }),
      ],
    });
    renderPage();
    expect(screen.getByText("Soft close")).toBeVisible();
  });

  it("notes the shared closing time when no lot is extended", () => {
    seed({
      bidding: [makeBidRow(NOW), makeBidRow(NOW, { _id: fixtureLotId("b") })],
    });
    renderPage();
    expect(
      screen.getByText(/^Closes (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /)
    ).toBeVisible();
  });
});
