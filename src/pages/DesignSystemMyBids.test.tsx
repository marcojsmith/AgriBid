import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DesignSystemMyBids } from "./DesignSystemMyBids";

describe("DesignSystemMyBids", () => {
  it("renders every frame of the mockup with fixture data", async () => {
    render(<DesignSystemMyBids />);
    for (const id of [
      "bidding",
      "closing",
      "extended",
      "won",
      "won-paid",
      "lost",
      "watching",
      "empty",
      "reg-unfinished",
      "reg-review",
      "reg-deposit",
    ]) {
      expect(screen.getByRole("region", { name: id })).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getAllByText("New Holland T6070").length).toBeGreaterThan(
        0
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("No bids yet").length).toBe(2);
    });
  }, 30_000);
});
