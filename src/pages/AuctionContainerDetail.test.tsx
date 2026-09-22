import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useQuery } from "convex/react";

import AuctionContainerDetail from "./AuctionContainerDetail";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getPublishedAuction: { name: "auctions:getPublishedAuction" },
    },
  },
}));

vi.mock("@/components/LotBrowser", () => ({
  LotBrowser: ({ auctionId }: { auctionId?: string }) => (
    <div data-testid="lot-browser">{auctionId}</div>
  ),
}));

describe("AuctionContainerDetail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText(/Auction Not Found/i)).toBeInTheDocument();
  });

  it("renders the container header and a lot browser scoped to the auction", () => {
    (useQuery as Mock).mockReturnValue({
      _id: "a1",
      title: "Spring Sale",
      description: "Tractors and combines",
      bannerImageUrl: undefined,
      startTime: Date.now() - 1000,
      endTime: Date.now() + 100000,
      status: "published",
      lotCount: 2,
      lots: [],
    });
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Spring Sale" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("lot-browser")).toBeInTheDocument();
    expect(screen.getByTestId("lot-browser")).toHaveTextContent("a1");
    expect(screen.getByText("Live Now")).toBeInTheDocument();
  });

  it("renders the lot browser without a legacy 'Lots (n)' heading or inline lot cards", () => {
    (useQuery as Mock).mockReturnValue({
      _id: "a1",
      title: "Spring Sale",
      description: undefined,
      bannerImageUrl: undefined,
      startTime: Date.now() - 100000,
      endTime: Date.now() - 1000,
      status: "closed",
      lotCount: 0,
      lots: [],
    });
    renderPage();
    expect(screen.queryByText(/Lots \(/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("lot-browser")).toBeInTheDocument();
  });
});
