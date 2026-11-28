import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DesignSystemAccount } from "./DesignSystemAccount";

describe("DesignSystemAccount", () => {
  it("renders every Account frame of the mockup with fixture data", async () => {
    render(<DesignSystemAccount />);
    for (const id of [
      "menu",
      "account",
      "account-buyer",
      "account-clear",
      "account-doc",
      "account-unfinished",
      "deposit",
      "deposit-refund",
      "deposit-requested",
      "deposit-refunded",
      "notifications",
      "notifications-off",
      "notifications-blocked",
      "seller",
    ]) {
      expect(screen.getByRole("region", { name: id })).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.getAllByText("Ends in 084").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getAllByText("Refund requested").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText("Notifications are blocked in your browser").length
      ).toBe(1);
    });
  }, 30_000);
});
