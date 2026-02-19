import { render, screen } from "@testing-library/react";
import { SellerInfo } from "../SellerInfo";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import * as convexReact from "convex/react";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

describe("SellerInfo", () => {
  it("renders seller details correctly when verified", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue({
      name: "Verified Farmer",
      isVerified: true,
      role: "Commercial Dealer",
      createdAt: Date.now() - 31536000000, // 1 year ago
      itemsSold: 15,
    });

    render(
      <MemoryRouter>
        <SellerInfo sellerId="seller123" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Verified Farmer")).toBeInTheDocument();
    expect(screen.getByText("Commercial Dealer")).toBeInTheDocument();
    expect(
      screen.getByText(/High-Integrity Verification/i),
    ).toBeInTheDocument();
  });

  it("shows skeleton UI when loading", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

    const { container } = render(
      <MemoryRouter>
        <SellerInfo sellerId="seller123" />
      </MemoryRouter>,
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows unavailable message when seller is null", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue(null);

    render(
      <MemoryRouter>
        <SellerInfo sellerId="seller123" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Seller information unavailable/i)).toBeInTheDocument();
  });

  it("hides verification badge when seller is unverified", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue({
      name: "Unverified User",
      isVerified: false,
      role: "Buyer",
      createdAt: Date.now(),
      itemsSold: 0,
    });

    render(
      <MemoryRouter>
        <SellerInfo sellerId="seller123" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unverified User")).toBeInTheDocument();
    expect(screen.queryByText(/High-Integrity Verification/i)).not.toBeInTheDocument();
  });
});
