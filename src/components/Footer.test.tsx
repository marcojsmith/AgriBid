import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import { Footer } from "./Footer";

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ appName: "AgriBid" }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const mockUseQuery = useQuery as Mock;

describe("Footer", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      businessName: "AgriBid",
    });
  });

  const renderFooter = () =>
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

  it("renders the brand name and copyright", () => {
    renderFooter();
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("contains the mission statement", () => {
    renderFooter();
    expect(screen.getByText(/built for farmers/i)).toBeInTheDocument();
  });

  it("renders all required navigation sections and links", () => {
    renderFooter();
    expect(screen.getByText(/How it Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety & Trust/i)).toBeInTheDocument();
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Help Center/i)).toBeInTheDocument();
  });

  it("links 'How it Works' to the /faq page", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /how it works/i });
    expect(link).toHaveAttribute("href", "/faq");
  });

  it("tightens vertical padding, column gaps and the bottom bar on phones", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    const inner = footer.firstElementChild;
    const grid = inner?.firstElementChild;
    const bottomBar = inner?.lastElementChild;

    // The footer used a flat `py-16`, which made it ~950px tall on a 375px
    // phone. Phones/tablets get a compact rhythm; desktop keeps today's values.
    expect(footer).toHaveClass("py-8", "md:py-16");
    expect(grid).toHaveClass("gap-8", "md:gap-10", "lg:gap-12");
    expect(bottomBar).toHaveClass("mt-8", "pt-6", "md:mt-16", "md:pt-8");
  });

  it("puts Platform and Support side by side on phones and keeps md+ layout unchanged", () => {
    renderFooter();
    const grid =
      screen.getByRole("contentinfo").firstElementChild?.firstElementChild;
    const brandColumn = screen.getAllByText(/AGRIBID/i)[0].parentElement;
    const platformColumn = screen.getByText("Platform").parentElement;
    const supportColumn = screen.getByText("Support").parentElement;
    const headquartersColumn = screen.getByText("Headquarters").parentElement;

    // Four stacked columns left the footer ~737px tall on a 375px phone.
    // Mobile is a two-column grid: Platform and Support share a row while the
    // brand block and Headquarters span the full width.
    expect(grid).toHaveClass("grid-cols-2", "lg:grid-cols-4");
    expect(brandColumn).toHaveClass("col-span-2", "md:col-span-1");
    expect(headquartersColumn).toHaveClass("col-span-2", "md:col-span-1");
    // The two link columns keep a single track on every breakpoint.
    expect(platformColumn?.className).not.toContain("col-span-2");
    expect(supportColumn?.className).not.toContain("col-span-2");

    // Source order is untouched, so md/lg still read brand → links → contact.
    const columns = Array.from(grid?.children ?? []) as HTMLElement[];
    expect(columns[0]).toBe(brandColumn);
    expect(columns[1]).toBe(platformColumn);
    expect(columns[2]).toBe(supportColumn);
    expect(columns[3]).toBe(headquartersColumn);
  });
});
