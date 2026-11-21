import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { HomeHero } from "./HomeHero";

const renderHero = (imageUrl?: string) =>
  render(
    <MemoryRouter>
      <HomeHero imageUrl={imageUrl} />
    </MemoryRouter>
  );

describe("HomeHero", () => {
  it("renders the headline, subline and both calls to action", () => {
    renderHero();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /South Africa.s online auction floor for serious farm machinery/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verified sellers\. Inspected equipment/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse live auctions" })
    ).toHaveAttribute("href", "/auctions");
    expect(
      screen.getByRole("link", { name: "Sell your equipment" })
    ).toHaveAttribute("href", "/sell");
  });

  it("lists the three proof points and lets them wrap", () => {
    renderHero();
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "FICA-verified sellers",
      "Condition-reported lots",
      "Anti-sniping soft close",
    ]);
    expect(items[0].parentElement).toHaveClass("flex-wrap");
  });

  it("shows the lead photo as a decorative eager image with an overlay", () => {
    const { container } = renderHero("https://cdn/hero.jpg");
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn/hero.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "eager");
  });

  it("renders no image without a photo", () => {
    const { container } = renderHero();
    expect(container.querySelector("img")).toBeNull();
  });
});
