import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";

import type { LotDetail } from "@/types/auction";
import { useSession } from "@/lib/auth-client";

import { MobileBidBar } from "./MobileBidBar";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

/**
 * Builds a lot-detail test fixture. Defaults to a live, biddable lot.
 *
 * @param overrides - Fields to override on the base fixture
 * @returns A lot detail fixture
 */
const createMockLot = (overrides: Partial<LotDetail> = {}): LotDetail =>
  ({
    _id: "lot123" as Id<"lots">,
    _creationTime: Date.now(),
    title: "Test Lot",
    make: "John Deere",
    model: "5075E",
    year: 2020,
    operatingHours: 1500,
    location: "Iowa, USA",
    categoryName: "Tractors",
    startingPrice: 45000,
    reservePrice: 50000,
    currentPrice: 47500,
    minIncrement: 100,
    sellerId: "seller123",
    status: "assigned",
    auctionStatus: "published",
    auctionStartTime: Date.now() - 60_000,
    auctionEndTime: Date.now() + 60_000,
    images: { additional: [] },
    ...overrides,
  }) as unknown as LotDetail;

/**
 * Records the state of a single mocked IntersectionObserver so tests can
 * assert which elements were observed and whether it was disconnected.
 */
interface MockObserverRecord {
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  observed: Set<Element>;
  disconnected: boolean;
}

/** Every IntersectionObserver instance created since the last reset. */
const mockObservers: MockObserverRecord[] = [];

/**
 * Builds a minimal IntersectionObserverEntry for a target.
 *
 * @param target - The observed element
 * @param isIntersecting - Whether the element intersects the viewport
 * @returns A synthetic IntersectionObserverEntry
 */
const createEntry = (
  target: Element,
  isIntersecting: boolean
): IntersectionObserverEntry => ({
  boundingClientRect: target.getBoundingClientRect(),
  intersectionRatio: isIntersecting ? 1 : 0,
  intersectionRect: isIntersecting
    ? target.getBoundingClientRect()
    : new DOMRect(),
  isIntersecting,
  rootBounds: null,
  target,
  time: Date.now(),
});

/**
 * Jest-free IntersectionObserver stand-in. Records every constructed
 * instance so tests can drive visibility changes and assert cleanup.
 */
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "";
  readonly thresholds: readonly number[] = [0];

  readonly record: MockObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.record = {
      callback,
      observer: this,
      observed: new Set<Element>(),
      disconnected: false,
    };
    mockObservers.push(this.record);
  }

  observe(target: Element): void {
    this.record.observed.add(target);
  }

  unobserve(target: Element): void {
    this.record.observed.delete(target);
  }

  disconnect(): void {
    this.record.observed.clear();
    this.record.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/**
 * Emits an intersection change to every mocked observer currently watching
 * the target.
 *
 * @param target - The observed element
 * @param isIntersecting - Whether the element now intersects the viewport
 */
const emitIntersection = (target: Element, isIntersecting: boolean) => {
  act(() => {
    mockObservers.forEach((record) => {
      if (record.observed.has(target)) {
        record.callback([createEntry(target, isIntersecting)], record.observer);
      }
    });
  });
};

const renderComponent = (auction: LotDetail) =>
  render(
    <MemoryRouter>
      <MobileBidBar auction={auction} />
      <div id="bidding-panel" data-testid="bidding-panel" />
      <footer data-testid="page-footer" />
    </MemoryRouter>
  );

describe("MobileBidBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObservers.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    // Not implemented in JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user123" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue({
      profile: { isVerified: true, kycStatus: "verified" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the current bid price", () => {
    renderComponent(createMockLot());
    expect(screen.getByText(/Current bid/i)).toBeInTheDocument();
    expect(screen.getByText(/47[,.\s\u00A0\u202F]*500/)).toBeInTheDocument();
  });

  it("shows status text without an action button for a closed auction", () => {
    renderComponent(createMockLot({ status: "sold" }));

    expect(screen.getByText(/Auction sold/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows ended text without an action button when the end time has passed", () => {
    const auction = createMockLot({
      auctionEndTime: Date.now() - 1000,
    });
    renderComponent(auction);

    expect(screen.getByText(/Auction ended/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Verify to bid link for logged-in unverified users", () => {
    vi.mocked(useQuery).mockReturnValue({
      profile: { isVerified: false, kycStatus: "none" },
    });

    renderComponent(createMockLot());

    const verifyLink = screen.getByRole("link", { name: /verify to bid/i });
    expect(verifyLink).toHaveAttribute("href", "/kyc");
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button that scrolls to the bidding panel for verified users", () => {
    renderComponent(createMockLot());

    const placeBidButton = screen.getByRole("button", {
      name: /place bid/i,
    });
    fireEvent.click(placeBidButton);

    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });

  it("shows a Place bid button for logged-out users", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>);

    renderComponent(createMockLot());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button while the profile query is still loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    renderComponent(createMockLot());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  describe("Viewport awareness", () => {
    it("observes both the bidding panel and the page footer", () => {
      renderComponent(createMockLot());

      expect(mockObservers).toHaveLength(1);
      const { observed } = mockObservers[0];
      expect(observed.has(screen.getByTestId("bidding-panel"))).toBe(true);
      expect(observed.has(screen.getByTestId("page-footer"))).toBe(true);
    });

    it("hides the bar while the bidding panel is in view", () => {
      renderComponent(createMockLot());

      emitIntersection(screen.getByTestId("bidding-panel"), true);

      expect(screen.getByTestId("mobile-bid-bar")).toHaveClass("hidden");
    });

    it("hides the bar while the page footer is in view", () => {
      renderComponent(createMockLot());

      emitIntersection(screen.getByTestId("page-footer"), true);

      expect(screen.getByTestId("mobile-bid-bar")).toHaveClass("hidden");
    });

    it("stays hidden while the footer remains in view after the panel leaves", () => {
      renderComponent(createMockLot());
      const panel = screen.getByTestId("bidding-panel");
      const footer = screen.getByTestId("page-footer");

      emitIntersection(panel, true);
      emitIntersection(footer, true);
      expect(screen.getByTestId("mobile-bid-bar")).toHaveClass("hidden");

      emitIntersection(panel, false);
      expect(screen.getByTestId("mobile-bid-bar")).toHaveClass("hidden");

      emitIntersection(footer, false);
      expect(screen.getByTestId("mobile-bid-bar")).not.toHaveClass("hidden");
    });

    it("keeps the bar visible while neither the panel nor the footer is in view", () => {
      renderComponent(createMockLot());

      expect(screen.getByTestId("mobile-bid-bar")).not.toHaveClass("hidden");
    });

    it("disconnects the observer on unmount", () => {
      const { unmount } = renderComponent(createMockLot());

      unmount();

      expect(mockObservers[0].disconnected).toBe(true);
    });

    it("stays visible when IntersectionObserver is unavailable", () => {
      vi.stubGlobal("IntersectionObserver", undefined);

      renderComponent(createMockLot());

      expect(mockObservers).toHaveLength(0);
      expect(screen.getByTestId("mobile-bid-bar")).not.toHaveClass("hidden");
    });

    it("stays visible when neither the bidding panel nor a footer is rendered", () => {
      render(
        <MemoryRouter>
          <MobileBidBar auction={createMockLot()} />
        </MemoryRouter>
      );

      expect(mockObservers).toHaveLength(0);
      expect(screen.getByTestId("mobile-bid-bar")).not.toHaveClass("hidden");
    });
  });
});
