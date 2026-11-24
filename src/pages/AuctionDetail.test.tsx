import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AuctionDetail from "./AuctionDetail";

const HOUR = 3_600_000;
const NOW = Date.now();
const clean = (s: string | null) => (s ?? "").replace(/[\u202f\u00a0]/g, " ");

interface Mock {
  results: Record<string, unknown>;
  authed: boolean;
  pastCta: boolean;
  verified: boolean;
  kyc: "pending" | undefined;
  mutations: Record<string, ReturnType<typeof vi.fn>>;
  calls: { name: string; args: unknown }[];
}

const h = vi.hoisted(() => {
  const state: Mock = {
    results: {},
    authed: false,
    pastCta: false,
    verified: true,
    kyc: undefined,
    mutations: {},
    calls: [],
  };
  return state;
});

/** A fake `api` whose every leaf stringifies to its last path segment. */
vi.mock("convex/_generated/api", () => {
  const make = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      get: (_t, key) =>
        key === Symbol.toPrimitive
          ? () => path[path.length - 1]
          : make([...path, String(key)]),
    });
  return { api: make([]) };
});
vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = String(ref);
    h.calls.push({ name, args });
    return h.results[name];
  },
  useMutation: (ref: unknown) => {
    const name = String(ref);
    h.mutations[name] ??= vi.fn().mockResolvedValue(undefined);
    return h.mutations[name];
  },
  useConvexAuth: () => ({ isAuthenticated: h.authed }),
}));
vi.mock("@/hooks/useNow", () => ({ useNow: () => NOW }));
vi.mock("@/hooks/useScrolledPast", () => ({
  useScrolledPast: () => [() => undefined, h.pastCta],
}));
vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({
    businessInfo: { telephone: "083 7 000 000", whatsapp: "+27 83 700 0000" },
  }),
}));
vi.mock("@/hooks/useVatRate", () => ({ useVatRate: () => 15 }));
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    profile: { isVerified: h.verified, kycStatus: h.kyc },
  }),
}));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));
const showToast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ds/showToast", () => ({ showToast }));
vi.mock("@/lib/viewSession", () => ({
  getViewSessionId: () => "session12345",
}));
vi.mock("@/components/auction/FeeBreakdown", () => ({
  FeeBreakdown: (props: { isWinner: boolean; sellerVatKind?: string }) => (
    <p>
      fee breakdown {props.isWinner ? "winner" : "seller"} {props.sellerVatKind}
    </p>
  ),
}));

const settings = {
  buyerPremiumPct: 12,
  deposit: { enabled: true, amount: 5000, refundDays: 3 },
  sellerCosts: { commissionPct: 8, listingFee: 0, payoutDays: 7 },
  financeContact: {
    name: "Lee-Anne Vermeulen",
    company: null,
    phone: "083 277 0178",
  },
  pushRemindersEnabled: false,
  minPhotosPerLot: 8,
};

const lot = (over: Record<string, unknown> = {}) => ({
  _id: "l1",
  title: "2016 New Holland T6070",
  make: "New Holland",
  model: "T6070",
  year: 2016,
  operatingHours: 4850,
  location: "Malmesbury, ZA",
  province: "western_cape",
  lotNumber: 3,
  auctionId: "a1",
  status: "assigned",
  auctionStatus: "published",
  auctionStartTime: NOW - HOUR,
  auctionEndTime: NOW + 51 * HOUR,
  startingPrice: 400_000,
  currentPrice: 400_000,
  minIncrement: 3500,
  bidCount: 0,
  watcherCount: 8,
  reserveState: "applies",
  buyerPremiumFraction: 0.12,
  sellerVatKind: "vat",
  sellerTypeLabel: "Farming business",
  isSeller: false,
  isWinner: false,
  powerKw: 104,
  drive: "4wd",
  transmission: "Semi-powershift",
  frontTyrePct: 70,
  rearTyrePct: 65,
  serialNumber: "ZBJC12345",
  conditionChecklist: {
    engine: true,
    hydraulics: true,
    tires: true,
    serviceHistory: true,
    notes: "starts, runs and drives.",
  },
  photos: [
    { url: "front.jpg", angle: "front" },
    { url: "meter.jpg", angle: "hour_meter" },
  ],
  coldStartVideoUrl: "cold.mp4",
  images: { additional: [] },
  ...over,
});

const moreLot = (id: string, n: number) => ({
  _id: id,
  make: "John Deere",
  model: `83${String(n)}`,
  year: 2013,
  operatingHours: 9500,
  location: "Wolmaransstad",
  lotNumber: n,
  startingPrice: 600_000,
  currentPrice: 600_000,
  reserveState: "applies",
  watchers: 11,
  bids: 0,
  effectiveEndTime: NOW + 51 * HOUR,
  status: "assigned",
});

function setup(
  lotOver: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  h.results = {
    getLotById: lot(lotOver),
    getPlatformSettings: settings,
    getPublishedAuction: { _id: "a1", title: "Year End Auction" },
    getEventFacets: { total: 85, capped: false },
    getLotNeighbours: {
      prev: { _id: "l2", lotNumber: 2 },
      next: { _id: "l4", lotNumber: 4 },
    },
    getEventLots: {
      matched: 5,
      lots: [
        moreLot("l1", 3),
        moreLot("l2", 2),
        moreLot("l4", 4),
        moreLot("l5", 5),
        moreLot("l6", 6),
      ],
    },
    getLotBidHistory: { bids: [], total: 0 },
    getMyLotBidState: { state: "none", myHighest: null },
    getWatchedLotIds: [],
    ...extra,
  };
}

function renderPage(path = "/auction/l1") {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/auction/:id" element={<AuctionDetail />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("AuctionDetail (lot page)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutations = {};
    h.calls = [];
    h.authed = false;
    h.pastCta = false;
    h.verified = true;
    h.kyc = undefined;
    setup();
  });

  it("shows loading, then not found for a missing lot", () => {
    h.results = { getLotById: undefined };
    const { unmount } = renderPage();
    expect(screen.getByText(/Loading lot/i)).toBeInTheDocument();
    unmount();
    h.results = { getLotById: null, getPlatformSettings: settings };
    renderPage();
    expect(screen.getByText("Lot not found")).toBeInTheDocument();
  });

  it("guest: title block, key facts, panel, sections and 'More in this sale'", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "New Holland T6070" })
    ).toBeInTheDocument();
    expect(screen.getByText("Lot 3")).toBeInTheDocument();
    expect(screen.getAllByText("Reserve applies").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "2016 · 4 850 hrs · 4WD · 104 kW · Malmesbury, Western Cape".replace(
          / /g,
          " "
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Year End Auction · 85 lots/ })
    ).toHaveAttribute("href", "/auctions/a1");
    expect(
      screen.getByRole("link", { name: /Previous lot, lot 2/ })
    ).toHaveAttribute("href", "/auction/l2");
    expect(
      screen.getByRole("link", { name: /Next lot, lot 4/ })
    ).toHaveAttribute("href", "/auction/l4");
    const panel = screen.getByRole("region", { name: "Bidding" });
    expect(clean(panel.textContent)).toContain("Bid R 400 000 → pay R 515 200");
    expect(
      within(panel).getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login?callbackUrl=%2Fauction%2Fl1");
    expect(clean(panel.textContent)).toContain("R 5 000 deposit");
    expect(screen.getByText("No bids yet.")).toBeInTheDocument();
    expect(screen.getByText("Seller ID checked (FICA)")).toBeInTheDocument();
    expect(screen.getByText("If you win")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Specs" })).toBeInTheDocument();
    expect(
      screen.getAllByText(/Request a transport quote/).length
    ).toBeGreaterThan(0);
    const more = screen.getByRole("region", { name: "More in this sale" });
    expect(within(more).getAllByRole("article")).toHaveLength(4);
    expect(within(more).queryByText("Lot 3")).toBeNull();
    expect(screen.queryByText(/More New Holland/)).toBeNull();
    expect(screen.queryByText(/Message Seller/i)).toBeNull();
  });

  it("records one view per page view with an anonymous session id", () => {
    renderPage();
    expect(h.mutations.recordLotView).toHaveBeenCalledOnce();
    expect(h.mutations.recordLotView).toHaveBeenCalledWith({
      lotId: "l1",
      sessionId: "session12345",
    });
  });

  it("does not break the page when recording the view fails", () => {
    h.mutations.recordLotView = vi.fn().mockRejectedValue(new Error("x"));
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("a private seller's lot shows the private total and condition rows", () => {
    setup({ sellerVatKind: "private", sellerTypeLabel: "Private farmer" });
    renderPage();
    expect(
      clean(screen.getByRole("region", { name: "Bidding" }).textContent)
    ).toContain("Bid R 400 000 → pay R 455 200");
    expect(screen.getByText("Seller: Private farmer")).toBeInTheDocument();
    expect(
      screen.getByText("No VAT on the bid (private seller)")
    ).toBeInTheDocument();
  });

  it("opens Fees & rules from the cost box", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Fees & rules" }));
    expect(screen.getByRole("dialog", { name: /Fees/ })).toBeInTheDocument();
  });

  it("registered: every bid goes through the confirm sheet, then the server", async () => {
    h.authed = true;
    renderPage();
    const field = screen.getByLabelText("Your bid");
    expect(clean((field as HTMLInputElement).value)).toBe("R 400 000");
    fireEvent.click(screen.getByRole("button", { name: /R\s403\s?500/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s403/ }));
    const sheet = await screen.findByRole("dialog", {
      name: "Confirm your bid",
    });
    const body = clean(sheet.textContent);
    expect(body).toContain("New Holland T6070 · Lot 3");
    expect(body).toContain("R 403 500");
    expect(body).toContain("Buyer's premium 12%");
    expect(body).toContain("R 48 420");
    expect(body).toContain("VAT 15%");
    expect(body).toContain("R 67 788");
    expect(body).toContain("R 519 708");
    expect(h.mutations.placeBid).not.toHaveBeenCalled();
    fireEvent.click(
      within(sheet).getByRole("button", { name: /Confirm bid R\s403/ })
    );
    await waitFor(() => {
      expect(h.mutations.placeBid).toHaveBeenCalledWith({
        lotId: "l1",
        amount: 403_500,
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Confirm your bid" })
      ).toBeNull();
    });
  });

  it("the confirm sheet uses the private-seller maths", async () => {
    h.authed = true;
    setup({ sellerVatKind: "private" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s400/ }));
    const sheet = await screen.findByRole("dialog", {
      name: "Confirm your bid",
    });
    const body = clean(sheet.textContent);
    expect(body).toContain("VAT 15% on the premium");
    expect(body).toContain("R 455 200");
  });

  it("someone bid before you: the sheet says so and re-prices at the new minimum", async () => {
    h.authed = true;
    h.mutations.placeBid = vi.fn().mockRejectedValue(
      Object.assign(new Error("x"), {}) // replaced below
    );
    const { ConvexError } = await import("convex/values");
    h.mutations.placeBid.mockRejectedValue(
      new ConvexError("Bid amount must be at least R403500")
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Bid R\s400/ }));
    const sheet = await screen.findByRole("dialog", {
      name: "Confirm your bid",
    });
    fireEvent.click(within(sheet).getByRole("button", { name: /Confirm bid/ }));
    expect(
      await within(sheet).findByText(/Someone bid before you/)
    ).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /^Bid R\s403/ }));
    expect(clean(sheet.textContent)).toContain("R 519 708");
    expect(within(sheet).queryByText(/Someone bid before you/)).toBeNull();
  });

  it("the seller sees no bid form or sticky bid action on their own lot", () => {
    h.authed = true;
    setup({ isSeller: true });
    renderPage();
    expect(screen.queryByLabelText("Your bid")).toBeNull();
    expect(screen.getByText(/This is your lot/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Bid R/ })).toBeNull();
  });

  it("an unverified user is sent to verify instead of bidding", () => {
    h.authed = true;
    h.verified = false;
    renderPage();
    expect(
      screen.getAllByRole("link", { name: "Verify to bid" }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Your bid")).toBeNull();
  });

  it("a pending verification shows no bid action anywhere", () => {
    h.authed = true;
    h.verified = false;
    h.kyc = "pending";
    h.pastCta = true;
    renderPage();
    expect(screen.getByText(/being reviewed/)).toBeInTheDocument();
    expect(
      screen
        .queryByRole("region", { name: "Bidding", hidden: false })
        ?.querySelector("input")
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bid R/ })).toBeNull();
  });

  it("leading: banner, Raise my bid, history with 'You'", () => {
    h.authed = true;
    setup(
      { bidCount: 4, currentPrice: 410_500, reserveState: "not_met" },
      {
        getMyLotBidState: { state: "leading", myHighest: 410_500 },
        getLotBidHistory: {
          bids: [
            {
              _id: "b1",
              amount: 410_500,
              timestamp: NOW - 120_000,
              label: "You",
              isMine: true,
            },
            {
              _id: "b2",
              amount: 407_000,
              timestamp: NOW - 840_000,
              label: "Bidder 7••41",
              isMine: false,
            },
          ],
          total: 4,
        },
      }
    );
    renderPage();
    expect(screen.getByText("You're leading")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Raise my bid" })
    ).toBeInTheDocument();
    expect(screen.getByText("Reserve not met")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Bidder 7••41")).toBeInTheDocument();
    expect(
      clean(screen.getByRole("region", { name: "Bidding" }).textContent)
    ).toContain("Bid R 414 000 → pay R 533 232");
  });

  it("outbid: warning banner", () => {
    h.authed = true;
    setup(
      { bidCount: 5 },
      { getMyLotBidState: { state: "outbid", myHighest: 400_000 } }
    );
    renderPage();
    expect(screen.getByText("You've been outbid")).toBeInTheDocument();
  });

  it("extended: urgent banner and seconds countdown", () => {
    h.authed = true;
    setup({
      bidCount: 9,
      isExtended: true,
      extendedEndTime: Date.now() + 112_000,
      auctionEndTime: Date.now() - 1000,
    });
    renderPage();
    expect(
      screen.getByText("Extended: a bid in the last 2 minutes added 2 minutes")
    ).toBeInTheDocument();
  });

  it("the sticky bar appears once the panel's button has scrolled away", () => {
    const { unmount } = renderPage();
    expect(screen.getAllByRole("region", { name: "Bidding" })).toHaveLength(1);
    unmount();
    h.pastCta = true;
    renderPage();
    expect(screen.getAllByRole("region", { name: "Bidding" })).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Register to bid" }).length
    ).toBeGreaterThan(1);
  });

  it("sticky bar for a registered user bids at the minimum through the sheet", async () => {
    h.authed = true;
    h.pastCta = true;
    renderPage();
    const bars = screen.getAllByRole("region", { name: "Bidding" });
    const bar = bars[bars.length - 1];
    expect(bar).toBeDefined();
    fireEvent.click(within(bar).getByRole("button", { name: /^Bid R\s400/ }));
    expect(
      await screen.findByRole("dialog", { name: "Confirm your bid" })
    ).toBeInTheDocument();
  });

  it("sticky bar for the leader scrolls to the panel", () => {
    h.authed = true;
    h.pastCta = true;
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    setup(
      { bidCount: 2 },
      { getMyLotBidState: { state: "leading", myHighest: 400_000 } }
    );
    renderPage();
    const bars = screen.getAllByRole("region", { name: "Bidding" });
    fireEvent.click(
      within(bars[bars.length - 1]).getByRole("button", {
        name: "Raise my bid",
      })
    );
    expect(scroll).toHaveBeenCalled();
  });

  it("sold: one Sold pill, sold price, no sticky bar, no View & collect, seller strip", () => {
    h.pastCta = true;
    setup({
      status: "sold",
      bidCount: 9,
      currentPrice: 428_000,
      isWinner: true,
      watcherCount: 12,
    });
    renderPage();
    expect(screen.getAllByText("Sold")).toHaveLength(1);
    expect(screen.getByText("Sold for")).toBeInTheDocument();
    expect(clean(screen.getByText(/9 bids/).textContent)).toContain(
      "12 watching"
    );
    expect(screen.getByText("You won this lot")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See current auctions" })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("region", { name: "Bidding" })).toHaveLength(
      0
    );
    expect(screen.queryByText("View & collect")).toBeNull();
    expect(screen.queryByText(/Request a transport quote/)).toBeNull();
    expect(screen.queryByText(/Need finance/)).toBeNull();
    expect(screen.queryByText("If you win")).toBeNull();
    expect(screen.getByText(/Selling a machine\?/)).toBeInTheDocument();
    expect(screen.getByText(/fee breakdown winner vat/)).toBeInTheDocument();
  });

  it("unsold with no bids says so without a price", () => {
    setup({ status: "unsold", bidCount: 0 });
    renderPage();
    expect(screen.getByText("Not sold")).toBeInTheDocument();
    expect(screen.getByText("No bids were placed.")).toBeInTheDocument();
  });

  it("unsold with bids shows the highest bid", () => {
    setup({ status: "unsold", bidCount: 2, currentPrice: 300_000 });
    renderPage();
    expect(screen.getByText("Highest bid")).toBeInTheDocument();
  });

  describe("under consideration", () => {
    const considering = (over: Record<string, unknown> = {}) => {
      setup({
        status: "under_consideration",
        bidCount: 6,
        currentPrice: 395_000,
        reserveState: "not_met",
        considerationDeadline: Date.UTC(2026, 10, 26, 9, 0),
        ...over,
      });
    };

    it("shows the pill and the top bid line, with no bid form or sticky bar", () => {
      h.pastCta = true;
      considering();
      renderPage();
      expect(screen.getAllByText("Under consideration").length).toBeGreaterThan(
        0
      );
      expect(screen.getByText("Top bid")).toBeInTheDocument();
      expect(clean(screen.getByText(/6 bids/).textContent)).toContain(
        "Under consideration"
      );
      expect(screen.queryByRole("region", { name: "Bidding" })).toBeNull();
      expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
      expect(screen.queryByText(/Your bid is with the seller/)).toBeNull();
      expect(screen.queryByText("View & collect")).toBeNull();
    });

    it("tells the top bidder their bid is with the seller, with the deadline", () => {
      h.authed = true;
      considering({ isWinner: true });
      renderPage();
      expect(
        clean(screen.getByText(/Your bid is with the seller/).textContent)
      ).toBe(
        "Your bid is with the seller. They have until Thu 26 Nov, 11:00 to accept. We'll notify you either way."
      );
      expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
    });

    it("gives the seller Accept and Decline with the deadline", () => {
      h.authed = true;
      considering({ isSeller: true, reservePrice: 420_000 });
      renderPage();
      expect(
        screen.getByText(/Decide by Thu 26 Nov, 11:00/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Accept R/ })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Decline" })
      ).toBeInTheDocument();
    });

    it("gives an admin the same actions", () => {
      h.authed = true;
      considering({ reservePrice: 420_000 });
      renderPage();
      expect(
        screen.getByRole("button", { name: /Accept R/ })
      ).toBeInTheDocument();
    });

    it("accepting asks first, then calls the server", async () => {
      h.authed = true;
      considering({ isSeller: true, reservePrice: 420_000 });
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /Accept R/ }));
      expect(h.mutations.acceptTopBid).not.toHaveBeenCalled();
      fireEvent.click(
        await screen.findByRole("button", { name: "Yes, accept" })
      );
      await waitFor(() => {
        expect(h.mutations.acceptTopBid).toHaveBeenCalledWith({ lotId: "l1" });
      });
    });
  });

  it("an upcoming lot shows when it opens and no bid form", () => {
    setup({
      auctionStartTime: NOW + 5 * HOUR,
      auctionEndTime: NOW + 50 * HOUR,
    });
    renderPage();
    expect(screen.getByText(/^Opens /)).toBeInTheDocument();
    expect(screen.queryByLabelText("Your bid")).toBeNull();
  });

  it("a lot that is not open yet is explained", () => {
    setup({ status: "approved", auctionStatus: undefined });
    renderPage();
    expect(screen.getByText(/isn't open for bidding yet/)).toBeInTheDocument();
  });

  it("the heart sends a guest to sign in", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    expect(toast.info).toHaveBeenCalledWith("Please sign in to watch a lot");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("watching shows the honest message; unwatching confirms", async () => {
    h.authed = true;
    h.mutations.toggleWatchlist = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "Watching. Find this lot in your watchlist."
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Removed from watchlist");
    });
  });

  it("a failed watch toggle shows an error", async () => {
    h.authed = true;
    h.mutations.toggleWatchlist = vi.fn().mockRejectedValue(new Error("x"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
    });
  });

  it("offers Report this lot to signed-in buyers but not to the seller or guests", () => {
    const { unmount } = renderPage();
    expect(
      screen.queryByRole("button", { name: /Report this lot/ })
    ).toBeNull();
    unmount();
    h.authed = true;
    const second = renderPage();
    expect(
      screen.getByRole("button", { name: /Report this lot/ })
    ).toBeInTheDocument();
    second.unmount();
    setup({ isSeller: true });
    renderPage();
    expect(
      screen.queryByRole("button", { name: /Report this lot/ })
    ).toBeNull();
  });

  it("falls back to a plain back link when the lot has no sale", () => {
    setup({ auctionId: undefined, lotNumber: undefined });
    h.results.getEventFacets = undefined;
    renderPage();
    expect(screen.getByRole("link", { name: "Auctions" })).toHaveAttribute(
      "href",
      "/auctions"
    );
  });

  it("the meter-photo link opens the viewer at the hour-meter photo", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "See meter photo" }));
    const viewer = screen.getByRole("dialog");
    expect(viewer).toHaveTextContent("3 / 3 · Hour meter");
  });

  it("hides empty sections: no transport row for a sold lot and no more-lots strip when alone", () => {
    setup({}, { getEventLots: { matched: 1, lots: [moreLot("l1", 3)] } });
    renderPage();
    expect(
      screen.queryByRole("region", { name: "More in this sale" })
    ).toBeNull();
  });
});
