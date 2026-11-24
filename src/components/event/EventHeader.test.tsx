import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { formatSastDate } from "@/lib/dates";

import { EventHeader, type EventHeaderSale } from "./EventHeader";

const HOUR = 3_600_000;
const SPACES = /[\u202f\u00a0]/g;
const NOW = Date.UTC(2025, 10, 23, 8, 0);

const live: EventHeaderSale = {
  title: "Year End Auction",
  startTime: NOW - HOUR,
  endTime: NOW + 51 * HOUR,
  effectiveEndTime: NOW + 51 * HOUR,
  bucket: "live",
};

function renderHeader(
  over: Partial<React.ComponentProps<typeof EventHeader>> = {}
) {
  const props: React.ComponentProps<typeof EventHeader> = {
    sale: live,
    now: NOW,
    example: { title: "New Holland T6070", bid: 400_000 },
    premiumPct: 12,
    deposit: { enabled: true, amount: 5000, refundDays: 3 },
    signedIn: false,
    onFeesClick: vi.fn(),
    onTransportClick: vi.fn(),
    shareUrl: "https://agribid.example/auctions/a1",
    onShareResult: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <EventHeader {...props} />
    </MemoryRouter>
  );
  return props;
}

describe("EventHeader", () => {
  it("shows a live sale: status, relative close first, then the date", () => {
    renderHeader();
    expect(screen.getByText("Live")).toBeVisible();
    expect(screen.getByText("Closes in 2d 3h")).toBeVisible();
    expect(
      screen.getByText(formatSastDate(live.effectiveEndTime))
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Year End Auction" })
    ).toBeVisible();
    expect(
      screen.getByText("Bids in the last 2 minutes add 2 minutes.")
    ).toBeVisible();
    expect(screen.getAllByText("e.g. New Holland T6070")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Register to bid" })
    ).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remind me" })).toBeNull();
  });

  it("opens the Fees & rules sheet from both links", () => {
    const props = renderHeader();
    for (const button of screen.getAllByRole("button", {
      name: "Fees & rules",
    })) {
      fireEvent.click(button);
    }
    expect(props.onFeesClick).toHaveBeenCalledTimes(4);
  });

  it("shows My bids and no deposit lines when signed in", () => {
    renderHeader({ signedIn: true });
    expect(screen.getByRole("link", { name: "My bids" })).toHaveAttribute(
      "href",
      "/dashboard/bids"
    );
    expect(screen.queryByText(/deposit, refunded/)).toBeNull();
  });

  it("hides the deposit lines when the deposit is off", () => {
    renderHeader({ deposit: { enabled: false, amount: 0, refundDays: 3 } });
    expect(screen.queryByText(/deposit, refunded/)).toBeNull();
  });

  it("hides the cost box without an example lot", () => {
    renderHeader({ example: null });
    expect(screen.queryByText(/^e\.g\./)).toBeNull();
  });

  it("shows an upcoming sale with its opening, closing and Remind me", () => {
    const onRemind = vi.fn();
    renderHeader({
      now: NOW,
      sale: {
        ...live,
        bucket: "upcoming",
        startTime: NOW + 3 * 24 * HOUR,
        endTime: NOW + 9 * 24 * HOUR,
        effectiveEndTime: NOW + 9 * 24 * HOUR,
      },
      onRemind,
    });
    expect(screen.getByText("Opens in 3d 0h")).toBeVisible();
    expect(screen.getByText(/^Closes /)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remind me" }));
    expect(onRemind).toHaveBeenCalled();
  });

  it("shows Reminder set, pressed, once a reminder exists", () => {
    const onRemind = vi.fn();
    renderHeader({
      sale: { ...live, bucket: "upcoming", startTime: NOW + 24 * HOUR },
      onRemind,
      reminded: true,
    });
    const button = screen.getByRole("button", { name: "Reminder set" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Remind me" })).toBeNull();
    fireEvent.click(button);
    expect(onRemind).toHaveBeenCalled();
  });

  it("disables Remind me while push is being set up", () => {
    renderHeader({
      sale: { ...live, bucket: "upcoming", startTime: NOW + 24 * HOUR },
      onRemind: vi.fn(),
      remindDisabled: true,
    });
    expect(screen.getByRole("button", { name: "Remind me" })).toBeDisabled();
  });

  it("has no Remind me on an upcoming sale unless the feature is on", () => {
    renderHeader({
      sale: { ...live, bucket: "upcoming", startTime: NOW + 24 * HOUR },
    });
    expect(screen.queryByRole("button", { name: "Remind me" })).toBeNull();
  });

  it("shows a closed sale with totals and See current auctions", () => {
    renderHeader({
      sale: { ...live, bucket: "closed", endTime: NOW - HOUR },
      closed: { sold: 5, total: 6, soldTotal: 982_000, underConsideration: 0 },
    });
    expect(screen.getByText("Closed")).toBeVisible();
    expect(
      screen.getByText(
        (text) => text.replace(SPACES, " ") === "5 of 6 lots sold · R 982 000"
      )
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /See current auctions/ })
    ).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Register to bid" })).toBeNull();
    expect(screen.queryByText(/^e\.g\./)).toBeNull();
    expect(screen.queryByText(/add 2 minutes/)).toBeNull();
  });

  it("opens the transport quote sheet from a button", () => {
    const props = renderHeader();
    fireEvent.click(
      screen.getByRole("button", { name: "Request a transport quote" })
    );
    expect(props.onTransportClick).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("link", { name: "Request a transport quote" })
    ).toBeNull();
  });
});
