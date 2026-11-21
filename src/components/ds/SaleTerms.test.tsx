import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { SaleTerms } from "./SaleTerms";

const renderTerms = (props: React.ComponentProps<typeof SaleTerms> = {}) =>
  render(
    <MemoryRouter>
      <SaleTerms {...props} />
    </MemoryRouter>
  );

describe("SaleTerms", () => {
  it("always shows payment, viewing and collection terms", () => {
    renderTerms();
    expect(
      screen.getByText("EFT within 48 hours of the sale")
    ).toBeInTheDocument();
    expect(screen.getByText("By appointment")).toBeInTheDocument();
    expect(screen.getByText("Within 7 days of payment")).toBeInTheDocument();
  });

  it("hides buyer's premium and VAT when unset", () => {
    renderTerms({ buyersPremiumPct: null });
    expect(screen.queryByText("Buyer's premium")).not.toBeInTheDocument();
    expect(screen.queryByText("VAT")).not.toBeInTheDocument();
  });

  it("shows buyer's premium and VAT from props, including zero", () => {
    renderTerms({ buyersPremiumPct: 0, vatPct: 15 });
    expect(screen.getByText("0% of the winning bid")).toBeInTheDocument();
    expect(screen.getByText("15% added where applicable")).toBeInTheDocument();
  });

  it("links to the full auction rules", () => {
    renderTerms({ rulesHref: "/rules" });
    expect(
      screen.getByRole("link", { name: "Full auction rules" })
    ).toHaveAttribute("href", "/rules");
  });
});
