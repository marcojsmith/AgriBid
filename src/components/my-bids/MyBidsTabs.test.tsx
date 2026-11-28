import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MyBidsTabs } from "./MyBidsTabs";

const COUNTS = { bidding: 5, won: 1, lost: 2, watching: 4 };

describe("MyBidsTabs", () => {
  it("renders a tablist with the four tabs and their counts", () => {
    render(<MyBidsTabs value="bidding" onChange={vi.fn()} counts={COUNTS} />);
    expect(screen.getByRole("tablist", { name: "My bids" })).toBeVisible();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Bidding5 lots",
      "Won1 lots",
      "Lost2 lots",
      "Watching4 lots",
    ]);
  });

  it("marks the selected tab and gives it the only tab stop", () => {
    render(<MyBidsTabs value="won" onChange={vi.fn()} counts={COUNTS} />);
    const won = screen.getByRole("tab", { name: /^Won/ });
    expect(won).toHaveAttribute("aria-selected", "true");
    expect(won).toHaveAttribute("tabindex", "0");
    expect(won).toHaveAttribute("aria-controls", "my-bids-panel-won");
    const lost = screen.getByRole("tab", { name: /^Lost/ });
    expect(lost).toHaveAttribute("aria-selected", "false");
    expect(lost).toHaveAttribute("tabindex", "-1");
  });

  it("selects a tab on click", () => {
    const onChange = vi.fn();
    render(<MyBidsTabs value="bidding" onChange={onChange} counts={COUNTS} />);
    fireEvent.click(screen.getByRole("tab", { name: /^Lost/ }));
    expect(onChange).toHaveBeenCalledWith("lost");
  });

  it("moves with the arrow keys, wrapping at both ends", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MyBidsTabs value="bidding" onChange={onChange} counts={COUNTS} />
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Bidding/ }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("won");
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Bidding/ }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenLastCalledWith("watching");
    rerender(
      <MyBidsTabs value="watching" onChange={onChange} counts={COUNTS} />
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Watching/ }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("bidding");
  });

  it("jumps with Home and End and ignores other keys", () => {
    const onChange = vi.fn();
    render(<MyBidsTabs value="won" onChange={onChange} counts={COUNTS} />);
    const won = screen.getByRole("tab", { name: /^Won/ });
    fireEvent.keyDown(won, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("watching");
    fireEvent.keyDown(won, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("bidding");
    onChange.mockClear();
    fireEvent.keyDown(won, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
