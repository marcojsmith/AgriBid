import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));
import { useQuery } from "convex/react";

import { Footer } from "./Footer";

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
});
