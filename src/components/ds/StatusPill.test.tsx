import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it.each([
    ["sold", "Sold"],
    ["not-sold", "Not sold"],
    ["under-consideration", "Under consideration"],
  ] as const)("renders %s as text with a decorative icon", (outcome, label) => {
    render(<StatusPill outcome={outcome} className="extra" />);
    const el = screen.getByText(label);
    expect(el).toHaveAttribute("data-outcome", outcome);
    expect(el).toHaveClass("extra", "whitespace-nowrap", "text-sm");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the smaller size inside cards", () => {
    render(<StatusPill outcome="sold" size="card" />);
    expect(screen.getByText("Sold")).toHaveClass("text-[13px]");
  });
});
