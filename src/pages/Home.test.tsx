import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";

import Home from "./Home";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

vi.mock("@/components/LotBrowser", () => ({
  LotBrowser: () => <div data-testid="lot-browser">Lot Browser</div>,
}));

vi.mock("@/components/auction/AuctionEventCard", () => ({
  AuctionEventCard: ({ event }: { event: { title: string } }) => (
    <div data-testid="auction-event-card">{event.title}</div>
  ),
}));

vi.mock("@/components/LoadingIndicator", () => ({
  LoadingPage: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingIndicator: () => <div data-testid="loading-indicator">Spinner</div>,
}));

describe("Home Page", () => {
  const NOW = Date.now();

  const activeEvent = {
    _id: "a1",
    title: "Spring Sale",
    status: "published",
    startTime: NOW - 1000,
    endTime: NOW + 100000,
    lotCount: 3,
  };

  const closedEvent = {
    _id: "a2",
    title: "Past Sale",
    status: "closed",
    startTime: NOW - 200000,
    endTime: NOW - 1000,
    lotCount: 1,
  };

  const endedPublishedEvent = {
    _id: "a3",
    title: "Ended Sale",
    status: "published",
    startTime: NOW - 200000,
    endTime: NOW - 1000,
    lotCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue([activeEvent, closedEvent]);

    (useSearchParams as Mock).mockReturnValue([new URLSearchParams(), vi.fn()]);
  });

  const renderHome = () => {
    return render(
      <HelmetProvider>
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      </HelmetProvider>
    );
  };

  it("renders the auction-event card view with heading and Sell button by default", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Auctions" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("auction-event-card")).toBeInTheDocument();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sell" })).toHaveAttribute(
      "href",
      "/sell"
    );
    expect(screen.queryByTestId("lot-browser")).not.toBeInTheDocument();
  });

  it("shows only active events on the default Active tab", () => {
    renderHome();
    const cards = screen.getAllByTestId("auction-event-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.queryByText("Past Sale")).not.toBeInTheDocument();
  });

  it("excludes a published event whose window has ended from the Active tab", () => {
    (useQuery as Mock).mockReturnValue([activeEvent, endedPublishedEvent]);
    renderHome();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.queryByText("Ended Sale")).not.toBeInTheDocument();
  });

  it("renders a loading state while events are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderHome();
    expect(screen.getByText(/Loading auctions/i)).toBeInTheDocument();
    expect(screen.queryByTestId("auction-event-card")).not.toBeInTheDocument();
  });

  it("shows the Active-tab empty state when no events are active", () => {
    (useQuery as Mock).mockReturnValue([closedEvent]);
    renderHome();
    expect(
      screen.getByText("No active auctions right now.")
    ).toBeInTheDocument();
  });

  it("shows the All-tab empty state when no events exist at all", () => {
    (useQuery as Mock).mockReturnValue([]);
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=all"),
      vi.fn(),
    ]);
    renderHome();
    expect(
      screen.getByText("No auction events have been published yet.")
    ).toBeInTheDocument();
  });

  it("shows only closed events (including ended published ones) on the Closed tab", () => {
    (useQuery as Mock).mockReturnValue([
      activeEvent,
      closedEvent,
      endedPublishedEvent,
    ]);
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=closed"),
      vi.fn(),
    ]);
    renderHome();
    const cards = screen.getAllByTestId("auction-event-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Past Sale")).toBeInTheDocument();
    expect(screen.getByText("Ended Sale")).toBeInTheDocument();
    expect(screen.queryByText("Spring Sale")).not.toBeInTheDocument();
  });

  it("shows both active and closed events on the All tab", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=all"),
      vi.fn(),
    ]);
    renderHome();
    const cards = screen.getAllByTestId("auction-event-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByText("Past Sale")).toBeInTheDocument();
  });

  it("switches to the Closed tab by writing the status URL param", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams(),
      setSearchParams,
    ]);
    renderHome();
    fireEvent.click(screen.getByTestId("status-tab-closed"));

    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.get("status")).toBe("closed");
  });

  it("switching back to Active removes the status URL param", () => {
    const setSearchParams = vi.fn();
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=all"),
      setSearchParams,
    ]);
    renderHome();
    fireEvent.click(screen.getByTestId("status-tab-active"));

    const calledWith = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(calledWith.has("status")).toBe(false);
  });

  it("falls back to the Active tab for an invalid status param", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=bogus"),
      vi.fn(),
    ]);
    renderHome();
    // Active tab is pressed
    expect(screen.getByTestId("status-tab-active")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByText("Past Sale")).not.toBeInTheDocument();
  });

  it("marks the pressed tab with aria-pressed", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("status=closed"),
      vi.fn(),
    ]);
    renderHome();
    expect(screen.getByTestId("status-tab-closed")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("status-tab-active")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("renders the global lot browser when a q param is present", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q=tractor"),
      vi.fn(),
    ]);
    renderHome();

    expect(screen.getByTestId("lot-browser")).toBeInTheDocument();
    expect(screen.queryByText("Spring Sale")).not.toBeInTheDocument();
    // The events query is skipped while searching
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("treats an empty q param as no search", () => {
    (useSearchParams as Mock).mockReturnValue([
      new URLSearchParams("q="),
      vi.fn(),
    ]);
    renderHome();

    expect(screen.queryByTestId("lot-browser")).not.toBeInTheDocument();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
  });

  it("fetches published events when not searching", () => {
    renderHome();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), {});
  });
});
