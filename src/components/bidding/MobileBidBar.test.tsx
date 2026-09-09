import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import type { Doc } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";
import { createMockAuction } from "@/test/factories";

import { MobileBidBar } from "./MobileBidBar";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const renderComponent = (auction: Doc<"auctions">) =>
  render(
    <MemoryRouter>
      <MobileBidBar auction={auction} />
      <div id="bidding-panel" />
    </MemoryRouter>
  );

describe("MobileBidBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("shows the current bid price", () => {
    renderComponent(createMockAuction());
    expect(screen.getByText(/Current bid/i)).toBeInTheDocument();
    expect(screen.getByText(/47[,.\s\u00A0\u202F]*500/)).toBeInTheDocument();
  });

  it("shows status text without an action button for a closed auction", () => {
    renderComponent(createMockAuction({ status: "sold" }));

    expect(screen.getByText(/Auction sold/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows ended text without an action button when the end time has passed", () => {
    const auction = createMockAuction({
      status: "active",
      endTime: Date.now() - 1000,
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

    renderComponent(createMockAuction());

    const verifyLink = screen.getByRole("link", { name: /verify to bid/i });
    expect(verifyLink).toHaveAttribute("href", "/kyc");
    expect(
      screen.queryByRole("button", { name: /place bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button that scrolls to the bidding panel for verified users", () => {
    renderComponent(createMockAuction());

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

    renderComponent(createMockAuction());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Place bid button while the profile query is still loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    renderComponent(createMockAuction());

    expect(
      screen.getByRole("button", { name: /place bid/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /verify to bid/i })
    ).not.toBeInTheDocument();
  });
});
