import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AuctionContainerDetail from "./AuctionContainerDetail";

const SPACES = /[\u202f\u00a0]/g;
const NOW = Date.UTC(2025, 10, 23, 8, 0);
const HOUR = 3_600_000;

interface MockState {
  results: Record<string, unknown>;
  calls: { name: string; args: unknown }[];
  authed: boolean;
  pastCta: boolean;
  toggle: ReturnType<typeof vi.fn>;
  needsInstall: boolean;
  permission: "granted" | "denied" | "unsupported";
}

const h = vi.hoisted(() => {
  const state: MockState = {
    results: {},
    calls: [],
    authed: false,
    pastCta: false,
    toggle: vi.fn(),
    needsInstall: false,
    permission: "granted",
  };
  return state;
});

vi.mock("convex/react", () => ({
  useQuery: (ref: { name: string }, args: unknown) => {
    if (args === "skip") return undefined;
    h.calls.push({ name: ref.name, args });
    return h.results[ref.name];
  },
  useMutation: () => h.toggle,
  useConvexAuth: () => ({ isAuthenticated: h.authed }),
}));
vi.mock("convex/_generated/api", () => {
  const ref = (name: string) => ({ name });
  return {
    api: {
      auctions: {
        getPublishedAuction: ref("getPublishedAuction"),
        getEventFacets: ref("getEventFacets"),
        getEventLots: ref("getEventLots"),
      },
      admin: {
        platformSettings: { getPlatformSettings: ref("getPlatformSettings") },
      },
      engagement: { getMostEngagedLots: ref("getMostEngagedLots") },
      watchlist: {
        getWatchedLotIds: ref("getWatchedLotIds"),
        toggleWatchlist: ref("toggleWatchlist"),
      },
    },
  };
});
vi.mock("@/hooks/useNow", () => ({ useNow: () => NOW }));
vi.mock("@/hooks/useScrolledPast", () => ({
  useScrolledPast: () => [() => undefined, h.pastCta],
}));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ businessInfo: { whatsapp: "+27 83 700 0000" } }),
}));
vi.mock("@/lib/homeScreen", () => ({
  browserNeedsHomeScreenInstall: () => h.needsInstall,
}));
vi.mock("@/lib/reminders", () => ({
  requestReminderPermission: () => Promise.resolve(h.permission),
}));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));
const showToast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ds/showToast", () => ({ showToast }));

const settings = {
  buyerPremiumPct: 12,
  deposit: { enabled: true, amount: 5000, refundDays: 3 },
  sellerCosts: { commissionPct: 8, listingFee: 0, payoutDays: 7 },
  financeContact: { name: "Lee-Anne", company: null, phone: "083 277 0178" },
  pushRemindersEnabled: false,
  minPhotosPerLot: 8,
};

const liveAuction = {
  _id: "a1",
  title: "Year End Auction",
  startTime: NOW - HOUR,
  endTime: NOW + 50 * HOUR,
  effectiveEndTime: NOW + 50 * HOUR,
  status: "published",
};

const lot = (over: Record<string, unknown> = {}) => ({
  _id: "l1",
  title: "T",
  make: "New Holland",
  model: "T6070",
  year: 2016,
  operatingHours: 4850,
  location: "Malmesbury",
  lotNumber: 3,
  auctionId: "a1",
  startingPrice: 400_000,
  currentPrice: 400_000,
  reserveState: "applies",
  watchers: 8,
  bids: 0,
  effectiveEndTime: NOW + 50 * HOUR,
  status: "assigned",
  ...over,
});

const facets = (over: Record<string, unknown> = {}) => ({
  total: 85,
  capped: false,
  categories: [{ categoryId: "c1", name: "Tractors", count: 48 }],
  makes: [{ make: "Ford", count: 8 }],
  priceRange: { min: 1000, max: 900_000 },
  outcomes: { sold: 0, notSold: 0, underConsideration: 0, soldTotal: 0 },
  ...over,
});

function setup(over: Record<string, unknown> = {}) {
  h.results = {
    getPublishedAuction: liveAuction,
    getPlatformSettings: settings,
    getEventFacets: facets(),
    getEventLots: { matched: 85, lots: [lot()] },
    getMostEngagedLots: [
      {
        lot: {
          make: "New Holland",
          model: "T6070",
          year: 2016,
          currentPrice: 450_000,
          startingPrice: 400_000,
        },
        bids: 2,
      },
    ],
    getWatchedLotIds: [],
    ...over,
  };
}

function pageTree(path = "/auctions/a1") {
  return (
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auctions/:id" element={<AuctionContainerDetail />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

function renderPage(path = "/auctions/a1") {
  return render(pageTree(path));
}

/**
 * The last element of a non-empty list.
 *
 * @param items - The list
 * @returns Its last element
 */
function lastOf<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error("Expected at least one element");
  return item;
}

const lastLotsArgs = () =>
  [...h.calls].reverse().find((c) => c.name === "getEventLots")?.args as Record<
    string,
    unknown
  >;

describe("AuctionContainerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.calls = [];
    h.authed = false;
    h.pastCta = false;
    h.needsInstall = false;
    h.permission = "granted";
    setup();
  });

  it("shows a loading state, then not-found for a missing sale", () => {
    h.results = { getPublishedAuction: undefined };
    const { unmount } = renderPage();
    expect(screen.getByText(/Loading auction/i)).toBeInTheDocument();
    unmount();
    h.results = { getPublishedAuction: null, getPlatformSettings: settings };
    renderPage();
    expect(screen.getByText("Auction not found")).toBeInTheDocument();
  });

  it("renders a live sale: header, cost box on the most engaged lot, lots and footer blocks", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Year End Auction" })
    ).toBeVisible();
    expect(screen.getByText("Closes in 2d 2h")).toBeVisible();
    expect(screen.getAllByText("e.g. 2016 New Holland T6070")).toHaveLength(2);
    expect(screen.getByText("85 lots")).toBeVisible();
    expect(screen.getByText("Lot 3")).toBeVisible();
    expect(screen.getByText("Before you bid")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /free valuation/ })
    ).toHaveAttribute("href", "https://wa.me/27837000000");
    expect(screen.getByRole("link", { name: /Auctions/ })).toHaveAttribute(
      "href",
      "/auctions"
    );
  });

  it("falls back to the first lot for the cost box when nothing is engaged yet", () => {
    setup({ getMostEngagedLots: [] });
    renderPage();
    expect(screen.getAllByText("e.g. New Holland T6070")).toHaveLength(2);
  });

  it("falls back to the first lot's current bid, and hides the cost box with no lots", () => {
    setup({
      getMostEngagedLots: [],
      getEventLots: {
        matched: 1,
        lots: [lot({ bids: 2, currentPrice: 500_000 })],
      },
    });
    const { unmount } = renderPage();
    expect(screen.getAllByText("e.g. New Holland T6070")).toHaveLength(2);
    unmount();
    setup({
      getMostEngagedLots: [],
      getEventFacets: facets({ total: 0 }),
      getEventLots: { matched: 0, lots: [] },
    });
    renderPage();
    expect(screen.queryByText(/^e\.g\./)).toBeNull();
    expect(screen.getByText("No lots in this sale yet.")).toBeVisible();
  });

  it("opens the Fees & rules sheet with both example totals", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Fees & rules" })[0]);
    expect(screen.getByRole("dialog", { name: "Fees & rules" })).toBeVisible();
    expect(screen.getByText("Example")).toBeVisible();
  });

  it("filters by category, make, price and search and sorts", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    expect(lastLotsArgs()).toMatchObject({ categoryId: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Ford 8" }));
    expect(lastLotsArgs()).toMatchObject({ make: "Ford" });
    fireEvent.click(screen.getByRole("button", { name: /^Price/ }));
    fireEvent.change(screen.getByLabelText("From (R)"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show lots" }));
    expect(lastLotsArgs()).toMatchObject({ minPrice: 5000 });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search make or model" }),
      { target: { value: " jx45 " } }
    );
    expect(lastLotsArgs()).toMatchObject({ search: "jx45" });
    fireEvent.click(screen.getByRole("button", { name: /Sort: Lot number/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Price low–high" }));
    expect(lastLotsArgs()).toMatchObject({ sort: "price_asc" });
    // The count line follows the filters.
    expect(screen.getByText("85 lots")).toBeVisible();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search make or model" }),
      { target: { value: "" } }
    );
    expect(lastLotsArgs().search).toBeUndefined();
  });

  it("starts from the ?q= search the header sent", () => {
    renderPage("/auctions/a1?q=case");
    expect(lastLotsArgs()).toMatchObject({ search: "case" });
  });

  it("uses the sale's own premium (a fraction) over the platform setting", () => {
    setup({
      getPublishedAuction: { ...liveAuction, defaultBuyerPremiumPct: 0.1 },
    });
    renderPage();
    expect(screen.getAllByText(/^10% premium \+ VAT/).length).toBeGreaterThan(
      0
    );
    // 12% platform premium would read 12%.
    expect(screen.queryByText(/^12% premium \+ VAT/)).toBeNull();
  });

  it("uses the platform premium when the sale has none", () => {
    renderPage();
    expect(screen.getAllByText(/^12% premium \+ VAT/).length).toBeGreaterThan(
      0
    );
  });

  it("keeps the previous lots on screen while the next page loads", () => {
    const view = renderPage();
    expect(screen.getByText("Lot 3")).toBeVisible();
    // The next result is not loaded yet.
    h.results.getEventLots = undefined;
    view.rerender(pageTree());
    expect(screen.getByText("Lot 3")).toBeVisible();
    expect(screen.queryByText("Loading lots")).toBeNull();
  });

  it("shows more lots 24 at a time", () => {
    setup({ getEventLots: { matched: 85, lots: [lot()] } });
    renderPage();
    expect(lastLotsArgs()).toMatchObject({ limit: 24 });
    fireEvent.click(
      screen.getByRole("button", { name: "Show 24 more · 1 of 85" })
    );
    expect(lastLotsArgs()).toMatchObject({ limit: 48 });
  });

  it("clears the filters from the empty state", () => {
    setup({ getEventLots: { matched: 0, lots: [] } });
    renderPage();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    expect(lastLotsArgs()).toMatchObject({ categoryId: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastLotsArgs().categoryId).toBeUndefined();
  });

  it("also clears a ?q= search sent from the header", () => {
    setup({ getEventLots: { matched: 0, lots: [] } });
    renderPage("/auctions/a1?q=zzz");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastLotsArgs().search).toBeUndefined();
    expect(
      screen.getByRole("searchbox", { name: "Search make or model" })
    ).toHaveValue("");
  });

  it("types into the search box without waiting for the URL", () => {
    renderPage();
    const box = screen.getByRole("searchbox", { name: "Search make or model" });
    fireEvent.change(box, { target: { value: "fo" } });
    expect(box).toHaveValue("fo");
    expect(lastLotsArgs()).toMatchObject({ search: "fo" });
  });

  it("drops category, make and price filters when the sale closes while open", () => {
    setup({
      getPublishedAuction: {
        ...liveAuction,
        endTime: NOW + 1000,
        effectiveEndTime: NOW + 1000,
      },
    });
    const { unmount } = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    expect(lastLotsArgs()).toMatchObject({ categoryId: "c1" });
    unmount();
    setup({
      getPublishedAuction: {
        ...liveAuction,
        status: "closed",
        endTime: NOW - HOUR,
        effectiveEndTime: NOW - HOUR,
      },
    });
    renderPage();
    expect(lastLotsArgs().categoryId).toBeUndefined();
  });

  it("says when no lot matches", () => {
    setup({ getEventLots: { matched: 0, lots: [] } });
    renderPage();
    expect(screen.getByText("No lots match these filters.")).toBeVisible();
  });

  it("shows a lower-bound count when the sale was capped", () => {
    setup({ getEventFacets: facets({ total: 100, capped: true }) });
    renderPage();
    expect(screen.getByText("100+ lots")).toBeVisible();
  });

  it("asks guests to sign in to watch, and toggles for signed-in viewers", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Watch/i }));
    expect(toast.info).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("login page")).toBeInTheDocument()
    );

    h.authed = true;
    h.toggle.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Watch/i }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole("button", { name: /Watch|Watching/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Removed from watchlist");
    });
    h.toggle.mockRejectedValueOnce(new Error("x"));
    fireEvent.click(screen.getByRole("button", { name: /Watch|Watching/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
    });
  });

  it("shows My bids to signed-in viewers", () => {
    h.authed = true;
    renderPage();
    expect(screen.getAllByRole("link", { name: "My bids" })[0]).toHaveAttribute(
      "href",
      "/dashboard/bids"
    );
  });

  it("shows the sticky bar once the header scrolls away", () => {
    h.pastCta = true;
    renderPage();
    const bar = screen.getByRole("region", { name: "Register to bid" });
    expect(bar).toBeVisible();
    fireEvent.click(
      lastOf(screen.getAllByRole("button", { name: "Register to bid" }))
    );
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("shows My bids in the sticky bar when signed in", () => {
    h.pastCta = true;
    h.authed = true;
    renderPage();
    fireEvent.click(lastOf(screen.getAllByRole("button", { name: "My bids" })));
    expect(screen.queryByText("login page")).toBeNull();
  });

  it("shares and reports the outcome", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Link copied");
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't share this link");
    });
    vi.unstubAllGlobals();
  });

  describe("upcoming sale", () => {
    const upcoming = {
      ...liveAuction,
      startTime: NOW + 3 * 24 * HOUR,
      endTime: NOW + 9 * 24 * HOUR,
      effectiveEndTime: NOW + 9 * 24 * HOUR,
    };

    it("shows the opening and hides Remind me while the feature is off", () => {
      setup({ getPublishedAuction: upcoming });
      renderPage();
      expect(screen.getByText("Opens in 3d 0h")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Remind me" })).toBeNull();
    });

    it("asks for permission on Remind me, then reports it", async () => {
      setup({
        getPublishedAuction: upcoming,
        getPlatformSettings: { ...settings, pushRemindersEnabled: true },
      });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
      expect(screen.getByText("Allow notifications?")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Allow" }));
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
      expect(screen.queryByText("Allow notifications?")).toBeNull();

      h.permission = "denied";
      fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
      fireEvent.click(screen.getByRole("button", { name: "Allow" }));
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Notifications are blocked in your browser settings."
        );
      });

      h.permission = "unsupported";
      fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
      fireEvent.click(screen.getByRole("button", { name: "Allow" }));
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "This browser can't show notifications."
        );
      });
    });

    it("shows the Add to Home Screen guide first on iPhone Safari", () => {
      h.needsInstall = true;
      setup({
        getPublishedAuction: upcoming,
        getPlatformSettings: { ...settings, pushRemindersEnabled: true },
      });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
      expect(screen.getByText("Get reminders on iPhone")).toBeVisible();
      expect(screen.queryByText("Allow notifications?")).toBeNull();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(screen.queryByText("Get reminders on iPhone")).toBeNull();
    });

    it("dismisses the permission prompt with Not now", () => {
      setup({
        getPublishedAuction: upcoming,
        getPlatformSettings: { ...settings, pushRemindersEnabled: true },
      });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
      fireEvent.click(screen.getByRole("button", { name: "Not now" }));
      expect(screen.queryByText("Allow notifications?")).toBeNull();
    });

    it("shows the opening time in the sticky bar", () => {
      h.pastCta = true;
      setup({ getPublishedAuction: upcoming });
      renderPage();
      expect(screen.getAllByText("Opens in 3d 0h").length).toBeGreaterThan(0);
    });
  });

  describe("closed sale", () => {
    const closedSale = {
      ...liveAuction,
      status: "closed",
      endTime: NOW - HOUR,
      effectiveEndTime: NOW - HOUR,
    };
    const closedFacets = facets({
      total: 6,
      outcomes: {
        sold: 5,
        notSold: 1,
        underConsideration: 0,
        soldTotal: 982_000,
      },
    });

    it("shows the totals, outcome chips, sold cards and no sale furniture", () => {
      h.pastCta = true;
      setup({
        getPublishedAuction: closedSale,
        getEventFacets: closedFacets,
        getEventLots: {
          matched: 6,
          lots: [
            lot({ _id: "s", status: "sold", bids: 9, currentPrice: 52_000 }),
            lot({ _id: "n", status: "unsold", bids: 4, currentPrice: 24_000 }),
          ],
        },
      });
      renderPage();
      expect(screen.getByText("Closed")).toBeVisible();
      expect(
        screen.getByText(
          (t) => t.replace(SPACES, " ") === "5 of 6 lots sold · R 982 000"
        )
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Sold 5" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Not sold 1" })).toBeVisible();
      expect(screen.queryByRole("button", { name: /Price/ })).toBeNull();
      expect(screen.queryByRole("group", { name: "Makes" })).toBeNull();
      expect(screen.getByText("Sold for")).toBeVisible();
      expect(screen.getByText("Highest bid")).toBeVisible();
      expect(
        screen.getAllByRole("link", { name: /See current auctions/ })
      ).toHaveLength(2);
      expect(
        screen.queryByRole("region", { name: "Register to bid" })
      ).toBeNull();
      expect(screen.queryByRole("link", { name: /free valuation/ })).toBeNull();
      expect(screen.queryByText("Before you bid")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Sold 5" }));
      expect(lastLotsArgs()).toMatchObject({ outcome: "sold" });
      fireEvent.click(screen.getByRole("button", { name: "Not sold 1" }));
      expect(lastLotsArgs()).toMatchObject({ outcome: "not_sold" });
    });

    it("lists under consideration only when a lot is in that state", () => {
      setup({
        getPublishedAuction: closedSale,
        getEventFacets: facets({
          total: 6,
          outcomes: {
            sold: 4,
            notSold: 0,
            underConsideration: 1,
            soldTotal: 841_000,
          },
        }),
        getEventLots: { matched: 6, lots: [] },
      });
      renderPage();
      fireEvent.click(
        screen.getByRole("button", { name: "Under consideration 1" })
      );
      expect(lastLotsArgs().outcome).toBeUndefined();
      expect(screen.getByText(/1 under consideration/)).toBeVisible();
    });
  });
});
