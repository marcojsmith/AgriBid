import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { BidStats } from "./BidStats";

describe("BidStats", () => {
  it("renders every stat with its label", () => {
    render(
      <BidStats
        stats={{
          totalActive: 2,
          winningCount: 1,
          outbidCount: 3,
          totalExposure: 125000,
        }}
      />
    );

    const cards = [
      ["Active Bids", "2"],
      ["Winning", "1"],
      ["Outbid", "3"],
      ["Total Exposure", "R 125 000,00"],
    ] as const;

    cards.forEach(([label, value]) => {
      const heading = screen.getByText(label);
      expect(heading.parentElement).toHaveTextContent(value);
    });
  });

  it("renders zeroed stats", () => {
    render(
      <BidStats
        stats={{
          totalActive: 0,
          winningCount: 0,
          outbidCount: 0,
          totalExposure: 0,
        }}
      />
    );

    const heading = screen.getByText("Active Bids");
    expect(heading.parentElement).toHaveTextContent("0");
  });
});
