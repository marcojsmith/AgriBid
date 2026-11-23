import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BidHistory, type BidHistoryRow } from "./BidHistory";

const NOW = Date.UTC(2026, 10, 25, 9, 0);

const rows: BidHistoryRow[] = [
  {
    id: "1",
    label: "Bidder 2••09",
    amount: 428_000,
    timestamp: NOW - 60_000,
    isMine: false,
  },
  {
    id: "2",
    label: "You",
    amount: 424_500,
    timestamp: NOW - 3 * 60_000,
    isMine: true,
  },
  {
    id: "3",
    label: "Bidder 7••41",
    amount: 421_000,
    timestamp: NOW - 4 * 3_600_000,
    isMine: false,
  },
  {
    id: "4",
    label: "Bidder 2••09",
    amount: 417_500,
    timestamp: NOW - 5 * 3_600_000,
    isMine: false,
  },
];

describe("BidHistory", () => {
  it("says there are no bids yet", () => {
    render(
      <BidHistory
        rows={[]}
        total={0}
        now={NOW}
        expanded={false}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText("No bids yet.")).toBeInTheDocument();
  });

  it("shows the newest three with masked labels, 'You' in bold and relative times", () => {
    render(
      <BidHistory
        rows={rows}
        total={9}
        now={NOW}
        expanded={false}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("You")).toHaveClass("font-bold");
    expect(screen.getByText("Bidder 2••09")).not.toHaveClass("font-bold");
    expect(screen.getByText("1 min ago")).toBeInTheDocument();
    expect(screen.getByText("3 min ago")).toBeInTheDocument();
    expect(screen.getByText("4 h ago")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show all 9 bids" })
    ).toBeInTheDocument();
  });

  it("expands and collapses", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <BidHistory
        rows={rows}
        total={4}
        now={NOW}
        expanded={false}
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Show all 4 bids" }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(
      <BidHistory
        rows={rows}
        total={4}
        now={NOW}
        expanded
        onToggle={onToggle}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Show fewer bids" })
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("has no button when everything already fits", () => {
    render(
      <BidHistory
        rows={rows.slice(0, 2)}
        total={2}
        now={NOW}
        expanded={false}
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
