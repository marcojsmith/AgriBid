import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SellerStrip } from "./SellerStrip";

describe("SellerStrip", () => {
  it("is one link with the valuation offer and the default commission", () => {
    render(<SellerStrip href="https://wa.me/27837000000" className="extra" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://wa.me/27837000000");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("bg-primary-soft", "min-h-14", "extra");
    expect(link).toHaveTextContent(
      "Selling a machine? WhatsApp us 3 photos for a free valuation. 8% + VAT commission, no listing fee"
    );
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the Admin-set commission", () => {
    render(<SellerStrip href="https://wa.me/1" commissionPct={7.5} />);
    expect(screen.getByRole("link")).toHaveTextContent("7.5% + VAT commission");
  });
});
