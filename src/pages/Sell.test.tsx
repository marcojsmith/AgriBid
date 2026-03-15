import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";

import Sell from "./Sell";

vi.mock("@/components/listing-wizard", () => ({
  ListingWizard: () => <div data-testid="listing-wizard">Listing Wizard</div>,
}));

describe("Sell Page", () => {
  const renderPage = () => {
    return render(
      <BrowserRouter>
        <Sell />
      </BrowserRouter>
    );
  };

  it("renders sell page with listing wizard", () => {
    renderPage();
    expect(screen.getByText("List Your Equipment")).toBeInTheDocument();
    expect(screen.getByTestId("listing-wizard")).toBeInTheDocument();
  });
});
