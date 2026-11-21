import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useQuery } from "convex/react";

import { useVatRate } from "@/hooks/useVatRate";

import AuctionContainerDetail from "./AuctionContainerDetail";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

vi.mock("convex/_generated/api", () => ({
  api: { auctions: { getPublishedAuction: { name: "x" } } },
}));

vi.mock("@/hooks/useVatRate", () => ({ useVatRate: vi.fn() }));

vi.mock("@/components/auction-event/EventLotBrowser", () => ({
  EventLotBrowser: ({ auctionId }: { auctionId?: string }) => (
    <div data-testid="lot-browser">{auctionId}</div>
  ),
}));

const HOUR = 3_600_000;

const auction = (over: Record<string, unknown> = {}) => ({
  _id: "a1",
  title: "Spring Sale",
  description: "Tractors and combines",
  startTime: Date.now() + 2 * HOUR,
  endTime: Date.now() + 50 * HOUR,
  status: "published",
  defaultBuyerPremiumPct: 0.05,
  ...over,
});

describe("AuctionContainerDetail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useVatRate as Mock).mockReturnValue(15);
  });

  const renderPage = () =>
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/auctions/a1"]}>
          <Routes>
            <Route path="/auctions/:id" element={<AuctionContainerDetail />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );

  it("renders a loading state while the auction is undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByText(/Loading auction/i)).toBeInTheDocument();
  });

  it("renders a not-found state when the auction is null", () => {
    (useQuery as Mock).mockReturnValue(null);
    renderPage();
    expect(screen.getByText(/Auction not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to auctions/i })
    ).toHaveAttribute("href", "/auctions");
  });

  describe("upcoming sale", () => {
    beforeEach(() => {
      (useQuery as Mock).mockReturnValue(auction());
    });

    it("renders the summary header, with no banner box", () => {
      renderPage();
      expect(
        screen.getByRole("heading", { level: 1, name: "Spring Sale" })
      ).toBeInTheDocument();
      expect(screen.getByText(/^Opens /)).toBeInTheDocument();
      expect(screen.getByText("Bidding opens in")).toBeInTheDocument();
      expect(screen.queryByTestId("auction-hero")).not.toBeInTheDocument();
      expect(screen.queryByText("published")).not.toBeInTheDocument();
    });

    it("shows the sale terms with this sale's buyer's premium and the VAT rate", () => {
      renderPage();
      expect(screen.getByText("5% of the winning bid")).toBeInTheDocument();
      expect(
        screen.getByText("15% added where applicable")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Full auction rules" })
      ).toHaveAttribute("href", "/faq");
    });

    it("scopes the lot browser to the auction", () => {
      renderPage();
      expect(screen.getByTestId("lot-browser")).toHaveTextContent("a1");
    });
  });

  it("hides the buyer's premium row when the premium is unset", () => {
    (useQuery as Mock).mockReturnValue(
      auction({ defaultBuyerPremiumPct: undefined })
    );
    renderPage();
    expect(screen.queryByText("Buyer's premium")).not.toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("hides the VAT row while the rate is unknown", () => {
    (useVatRate as Mock).mockReturnValue(undefined);
    (useQuery as Mock).mockReturnValue(auction());
    renderPage();
    expect(screen.queryByText("VAT")).not.toBeInTheDocument();
  });

  it("shows a live sale with a closing countdown", () => {
    (useQuery as Mock).mockReturnValue(
      auction({ startTime: Date.now() - HOUR })
    );
    renderPage();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Sale closes in")).toBeInTheDocument();
  });

  it("shows an ended sale as closed with no countdown", () => {
    (useQuery as Mock).mockReturnValue(
      auction({
        status: "closed",
        startTime: Date.now() - 50 * HOUR,
        endTime: Date.now() - HOUR,
      })
    );
    renderPage();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByTestId("sale-countdown")).not.toBeInTheDocument();
  });
});
