import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SaleHeader, type SaleHeaderAuction } from "./SaleHeader";

const HOUR = 3_600_000;

const sale = (over: Partial<SaleHeaderAuction> = {}): SaleHeaderAuction => ({
  title: "Spring Machinery Sale",
  startTime: Date.now() + 2 * HOUR,
  endTime: Date.now() + 50 * HOUR,
  status: "published",
  ...over,
});

describe("SaleHeader", () => {
  it("upcoming: shows the Opens badge, SAST summary and a Bidding opens in card", () => {
    render(<SaleHeader auction={sale()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Spring Machinery Sale" })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Opens /)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Online auction · Opens .* SAST · Lots close from .* SAST/
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Bidding opens in")).toBeInTheDocument();
    expect(screen.getByTestId("sale-countdown")).toBeInTheDocument();
  });

  it("live: shows a Live badge and a closing countdown", () => {
    render(
      <SaleHeader
        auction={sale({
          startTime: Date.now() - HOUR,
          endTime: Date.now() + 50 * HOUR,
        })}
      />
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("First lot closes in")).toBeInTheDocument();
  });

  it("ended: shows Closed, the closing date and no countdown", () => {
    render(
      <SaleHeader
        auction={sale({
          status: "closed",
          startTime: Date.now() - 50 * HOUR,
          endTime: Date.now() - 2 * HOUR,
        })}
      />
    );
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText(/Sale closed .* SAST/)).toBeInTheDocument();
    expect(screen.queryByTestId("sale-countdown")).not.toBeInTheDocument();
  });

  it("never shows internal states or a Remind me action", () => {
    render(<SaleHeader auction={sale()} />);
    expect(screen.queryByText(/published/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remind me/i)).not.toBeInTheDocument();
  });

  it("shows the description when there is one", () => {
    render(<SaleHeader auction={sale({ description: "Tractors and more" })} />);
    expect(screen.getByText("Tractors and more")).toBeInTheDocument();
  });
});
