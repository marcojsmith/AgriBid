import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { FeesRulesSheet } from "./FeesRulesSheet";

describe("FeesRulesSheet", () => {
  it("shows every rule from the settings", () => {
    render(
      <FeesRulesSheet
        open
        onOpenChange={() => undefined}
        premiumPct={12}
        deposit={{ enabled: true, amount: 5000, refundDays: 3 }}
      />
    );
    expect(screen.getByRole("dialog", { name: "Fees & rules" })).toBeVisible();
    expect(screen.getByText("12% of the bid, plus VAT")).toBeInTheDocument();
    expect(screen.getByText(/15% on the premium/)).toBeInTheDocument();
    expect(
      screen.getByText(/refunded within 3 working days if you don't buy/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your deposit counts towards payment/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Bids in the last 2 minutes add 2 minutes")
    ).toBeInTheDocument();
  });

  it("leaves the deposit rows out when no deposit applies", () => {
    render(
      <FeesRulesSheet
        open
        onOpenChange={() => undefined}
        premiumPct={10.5}
        vatRatePct={16}
        deposit={{ enabled: false, amount: 5000, refundDays: 3 }}
      />
    );
    expect(screen.queryByText("Registration deposit")).toBeNull();
    expect(screen.queryByText(/deposit counts/)).toBeNull();
    expect(screen.getByText("10.5% of the bid, plus VAT")).toBeInTheDocument();
    expect(screen.getByText(/^16% on the premium/)).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    render(
      <FeesRulesSheet
        open={false}
        onOpenChange={() => undefined}
        premiumPct={12}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
