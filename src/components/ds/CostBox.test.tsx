import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { CostBox } from "./CostBox";

// Testing Library normalises whitespace (incl. U+202F) to plain spaces.
const R = (digits: string) => `R ${digits}`;

describe("CostBox", () => {
  it("includes fixed buyer fees before VAT", () => {
    render(
      <CostBox seller="vat" bid={100_000} premiumPct={10} fixedFees={500} />
    );
    expect(
      screen.getByText(`Bid ${R("100 000")} → pay ${R("127 075")}`)
    ).toBeInTheDocument();
  });

  it("works the total for a VAT-registered seller (VAT on bid + premium)", () => {
    render(<CostBox seller="vat" feesHref="/fees" />);
    expect(
      screen.getByText(`Bid ${R("400 000")} → pay ${R("515 200")}`)
    ).toBeInTheDocument();
    expect(screen.getByText(/12% premium \+ 15% VAT ·/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fees & rules" })).toHaveAttribute(
      "href",
      "/fees"
    );
  });

  it("charges VAT on the premium only for a private seller", () => {
    render(<CostBox seller="private" />);
    expect(
      screen.getByText(`Bid ${R("400 000")} → pay ${R("455 200")}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/12% premium \+ 15% VAT on the premium ·/)
    ).toBeInTheDocument();
  });

  it("states only '+ VAT' when the seller is not known, with an example", () => {
    const { container } = render(
      <CostBox seller="any" bid={200_000} example="Lot 3, Landini" />
    );
    expect(screen.getByText("e.g. Lot 3, Landini")).toBeInTheDocument();
    expect(
      screen.getByText(`Bid ${R("200 000")} → pay ${R("257 600")}`)
    ).toBeInTheDocument();
    expect(container.textContent).toContain("12% premium + VAT ·");
    expect(container.firstElementChild).toHaveAttribute("data-seller", "any");
  });

  it("uses Admin-set premium and VAT rates", () => {
    render(<CostBox bid={100_000} premiumPct={10} vatRatePct={14.5} />);
    // premium 10 000, VAT 14.5% of 110 000 = 15 950
    expect(
      screen.getByText(`Bid ${R("100 000")} → pay ${R("125 950")}`)
    ).toBeInTheDocument();
    expect(screen.getByText(/10% premium \+ 14\.5% VAT/)).toBeInTheDocument();
  });

  it("opens the Fees & rules sheet through a button", () => {
    const onFeesClick = vi.fn();
    render(<CostBox onFeesClick={onFeesClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Fees & rules" }));
    expect(onFeesClick).toHaveBeenCalledTimes(1);
  });

  it("shows plain text when there is nowhere to link and supports the dark band", () => {
    const { container } = render(<CostBox onDark className="extra" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild).toHaveClass(
      "extra",
      "border-hero-muted/40"
    );
  });
});
