import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { showToast } from "@/components/ds/showToast";

import Home from "./Home";

/** What each mocked query returns; tests change these. */
interface MockData {
  sales: unknown[];
  salesStatus: string;
  settings: unknown;
  featured: unknown[];
  home: unknown;
  watched: string[];
  signedIn: boolean;
  businessInfo: unknown;
  ctaGone: boolean;
  toggle: Mock;
  navigate: Mock;
}

const data = vi.hoisted<MockData>(() => ({
  sales: [],
  salesStatus: "Exhausted",
  settings: undefined,
  featured: [],
  home: undefined,
  watched: [],
  signedIn: false,
  businessInfo: undefined,
  ctaGone: false,
  toggle: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: (_ref: unknown, args: unknown) => ({
    results: args === "skip" ? [] : data.sales,
    status: data.salesStatus,
    loadMore: vi.fn(),
  }),
  useQuery: (ref: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref === "settings") return data.settings;
    if (ref === "featured") return data.featured;
    if (ref === "homeLots") return data.home;
    if (ref === "watched") return data.watched;
    return undefined;
  },
  useMutation: () => data.toggle,
  useConvexAuth: () => ({ isAuthenticated: data.signedIn, isLoading: false }),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: { getPublishedAuctions: "pub", getHomeLots: "homeLots" },
    admin: { platformSettings: { getPlatformSettings: "settings" } },
    engagement: { getMostEngagedLots: "featured" },
    watchlist: { getWatchedLotIds: "watched", toggleWatchlist: "toggle" },
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
    useNavigate: () => data.navigate,
  };
});

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ appName: "AgriBid", businessInfo: data.businessInfo }),
}));

vi.mock("@/hooks/useScrolledPast", () => ({
  useScrolledPast: () => data.ctaGone,
}));

vi.mock("@/components/LotBrowser", () => ({
  LotBrowser: () => <div data-testid="lot-browser">Lot Browser</div>,
}));

vi.mock("@/components/ds/showToast", () => ({ showToast: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const NOW = Date.now();
const HOUR = 3_600_000;
// 51.5 h: the countdown reads "2d 3h" even a little after NOW was taken.
const CLOSE = NOW + 51.5 * HOUR;

/**
 * A sale as `getPublishedAuctions` returns it.
 *
 * @param id - Sale id
 * @param over - Fields to override
 * @returns The sale
 */
const sale = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  title: `Sale ${id}`,
  status: "published",
  startTime: NOW - HOUR,
  endTime: CLOSE,
  effectiveEndTime: CLOSE,
  lotCount: 85,
  leadImageUrls: ["https://img/sale.jpg"],
  ...over,
});

const lot = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  make: "New Holland",
  model: "T6070",
  year: 2016,
  operatingHours: 4850,
  location: "Malmesbury",
  lotNumber: 3,
  startingPrice: 400000,
  currentPrice: 400000,
  hasReserve: true,
  reserveMet: false,
  watchers: 8,
  bids: 0,
  effectiveEndTime: NOW + 51 * HOUR,
  ...over,
});

const settings = {
  buyerPremiumPct: 12,
  deposit: { enabled: true, amount: 5000, refundDays: 3 },
  sellerCosts: { commissionPct: 8, listingFee: 0, payoutDays: 7 },
  financeContact: { name: "Lee-Anne", company: null, phone: "083 277 0178" },
  pushRemindersEnabled: false,
  minPhotosPerLot: 8,
};

const home = {
  total: 85,
  matched: 85,
  capped: false,
  categories: [{ categoryId: "c1", name: "Tractors", count: 48 }],
  makes: [{ make: "Ford", count: 8 }],
  priceRange: { min: 1000, max: 900000 },
  lots: [lot("l1")],
};

const renderHome = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </HelmetProvider>
  );

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.sales = [sale("a")];
    data.salesStatus = "Exhausted";
    data.settings = settings;
    data.featured = [
      {
        bids: 0,
        lot: {
          _id: "l9",
          year: 2016,
          make: "John Deere",
          model: "8370RT",
          location: "Wolmaranstad",
          startingPrice: 2000000,
          currentPrice: 2000000,
          images: { front: "https://img/jd.jpg", additional: [] },
        },
      },
    ];
    data.home = home;
    data.watched = [];
    data.signedIn = false;
    data.businessInfo = { whatsapp: "+27 82 555 0100" };
    data.ctaGone = false;
    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
  });

  it("shows the sale hero, the featured lot and the grid for one live sale", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Sale a" })
    ).toBeVisible();
    expect(screen.getByText("Closes in 2d 3h")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /2016 John Deere 8370RT/ })
    ).toBeVisible();
    expect(screen.getByText(/Bid R 2 000 000 → pay/)).toBeVisible();
    expect(screen.getByText("New Holland T6070")).toBeVisible();
    expect(screen.getByRole("button", { name: "All 85" })).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "View all 85 lots" })[0]
    ).toHaveAttribute("href", "/auctions/a");
    expect(screen.getByText("Before you bid")).toBeVisible();
    expect(screen.getByText("Selling a machine?")).toBeVisible();
    expect(screen.queryByText(/Most watched/)).toBeNull();
  });

  it("uses the first grid lot for the cost example without a featured lot", () => {
    data.featured = [];
    renderHome();
    expect(screen.getByText(/Bid R 400 000 → pay/)).toBeVisible();
  });

  it("hides the cost box when there is no lot at all", () => {
    data.featured = [];
    data.home = { ...home, lots: [], total: 0, matched: 0 };
    renderHome();
    expect(screen.queryByText(/→ pay/)).toBeNull();
    expect(screen.getByText("No lots match these filters.")).toBeVisible();
  });

  it("uses the multi-sale list when two sales are open", () => {
    data.sales = [
      sale("a"),
      sale("b", {
        startTime: NOW + HOUR,
        endTime: NOW + 9 * HOUR,
        effectiveEndTime: NOW + 9 * HOUR,
        lotCount: 4,
      }),
    ];
    renderHome();
    expect(screen.getByRole("list", { name: "Auctions" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(
      screen.getAllByRole("link", { name: "View all 85 lots" })[0]
    ).toHaveAttribute("href", "/auctions");
  });

  it("shows an empty state when no sale is open", () => {
    data.sales = [];
    data.home = undefined;
    renderHome();
    expect(
      screen.getByRole("heading", { name: "No auctions are open right now" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "See past auctions" })
    ).toHaveAttribute("href", "/auctions");
  });

  it("shows a loading line while the first page loads", () => {
    data.sales = [];
    data.salesStatus = "LoadingFirstPage";
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Loading auctions");
  });

  it("shows the lot browser for a search query", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    renderHome();
    expect(screen.getByTestId("lot-browser")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("signed in: My bids replaces Register to bid", () => {
    data.signedIn = true;
    renderHome();
    expect(screen.getByRole("link", { name: "My bids" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Register to bid" })).toBeNull();
  });

  it("shows the sticky bar with the countdown once the CTA scrolls out", () => {
    data.ctaGone = true;
    renderHome();
    const bar = screen.getByRole("region", { name: "Register to bid" });
    expect(bar).toHaveTextContent("Closes in 2d 3h");
    expect(screen.getByRole("link", { name: "WhatsApp us" })).toHaveAttribute(
      "href",
      "https://wa.me/27825550100"
    );
    fireEvent.click(screen.getByRole("button", { name: "Register to bid" }));
    expect(data.navigate).toHaveBeenCalledWith("/login");
  });

  it("sticky bar says when an upcoming sale opens and routes signed-in users to My bids", () => {
    data.ctaGone = true;
    data.signedIn = true;
    data.sales = [
      sale("a", {
        startTime: NOW + HOUR,
        endTime: NOW + 9 * HOUR,
        effectiveEndTime: NOW + 9 * HOUR,
      }),
    ];
    renderHome();
    expect(
      screen.getByRole("region", { name: "Register to bid" })
    ).toHaveTextContent(/Opens \w{3} \d+ \w{3}, \d{2}:\d{2}/);
    fireEvent.click(screen.getByRole("button", { name: "My bids" }));
    expect(data.navigate).toHaveBeenCalledWith("/dashboard/bids");
  });

  it("leaves out the WhatsApp strip and logo when no number is set", () => {
    data.businessInfo = undefined;
    data.ctaGone = true;
    renderHome();
    expect(screen.queryByText("Selling a machine?")).toBeNull();
    expect(screen.queryByRole("link", { name: "WhatsApp us" })).toBeNull();
  });

  it("opens Fees & rules from the cost box", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Fees & rules" }));
    expect(screen.getByRole("dialog", { name: "Fees & rules" })).toBeVisible();
  });

  it("sends a guest to sign in when they tap the heart", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    expect(toast.info).toHaveBeenCalled();
    expect(data.navigate).toHaveBeenCalledWith("/login?callbackUrl=%2F");
    expect(data.toggle).not.toHaveBeenCalled();
  });

  it("watching a lot shows the watching toast, unwatching a plain one", async () => {
    data.signedIn = true;
    data.toggle.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        "Watching. We'll notify you 1 hour before close and if you're outbid."
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Removed from watchlist");
    });
  });

  it("reports a failed watch", async () => {
    data.signedIn = true;
    data.toggle.mockRejectedValueOnce(new Error("x"));
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /Watch lot 3/ }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
    });
  });

  it("filters the grid by category, make and price and submits a search", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Tractors 48" }));
    fireEvent.click(screen.getByRole("button", { name: "Ford 8" }));
    expect(screen.getByRole("button", { name: "Tractors 48" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /Price/ }));
    fireEvent.change(screen.getByLabelText("From (R)"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show lots" }));
    const box = screen.getByRole("searchbox", { name: "Search make or model" });
    fireEvent.change(box, { target: { value: "ford" } });
    fireEvent.submit(box);
    expect(data.navigate).toHaveBeenCalledWith("/?q=ford");
  });
});
