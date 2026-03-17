import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import type { Doc, Id } from "convex/_generated/dataModel";

import { useSession } from "@/lib/auth-client";

import { AuctionHeader } from "./AuctionHeader";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAuction = {
  _id: "a1" as unknown as Id<"auctions">,
  _creationTime: 100,
  title: "Test Tractor",
  year: 2022,
  make: "John Deere",
  model: "8R",
  location: "Iowa",
  operatingHours: 500,
  status: "active" as const,
  sellerId: "s1",
  categoryId: "c1" as unknown as Id<"equipmentCategories">,
  categoryName: "Tractors",
  reservePrice: 1000,
  startingPrice: 500,
  currentPrice: 750,
  minIncrement: 50,
  images: ["img1"],
};

const { mockNavigate, mockLocation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLocation: vi
    .fn()
    .mockReturnValue({ pathname: "/auction/a1", search: "", hash: "" }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: () => mockNavigate,
    useLocation: mockLocation,
  };
});

describe("AuctionHeader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLocation.mockReturnValue({
      pathname: "/auction/a1",
      search: "",
      hash: "",
    });
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue(false);
    vi.mocked(useMutation).mockReturnValue(
      vi.fn() as unknown as ReturnType<typeof useMutation>
    );
  });

  const renderComponent = (
    auction: Doc<"auctions"> & {
      categoryName?: string;
    } = mockAuction as unknown as Doc<"auctions"> & { categoryName?: string }
  ) => {
    return render(
      <MemoryRouter>
        <AuctionHeader auction={auction} />
      </MemoryRouter>
    );
  };

  it("renders auction details correctly", () => {
    renderComponent();
    expect(screen.getByText("Test Tractor")).toBeDefined();
    expect(screen.getByText("2022 John Deere")).toBeDefined();
    expect(screen.getByText("Iowa")).toBeDefined();
    expect(screen.getByText("500 Operating Hours")).toBeDefined();
  });

  it("shows login toast when unauthenticated user clicks watch", () => {
    renderComponent();
    const watchBtn = screen.getByRole("button", { name: /watch/i });
    fireEvent.click(watchBtn);
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("sign in"));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/login")
    );
  });

  it("toggles watchlist for authenticated user", async () => {
    const toggleMock = vi.fn().mockResolvedValue(true);
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue(false);
    vi.mocked(useMutation).mockReturnValue(
      toggleMock as unknown as ReturnType<typeof useMutation>
    );

    renderComponent();
    const watchBtn = screen.getByRole("button", { name: "Watch" });
    fireEvent.click(watchBtn);

    await waitFor(() => {
      expect(toggleMock).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Added to watchlist");
    });
  });

  it("shows SOLD badge and YOU WON if user is winner", () => {
    const soldAuction = {
      ...mockAuction,
      status: "sold" as const,
      winnerId: "u1",
    };
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    renderComponent(
      soldAuction as unknown as Doc<"auctions"> & { categoryName?: string }
    );
    expect(screen.getByText("YOU WON")).toBeDefined();
    expect(screen.getByText(/Congratulations/i)).toBeDefined();
  });

  it("shows SOLD badge if user is not winner", () => {
    const soldAuction = {
      ...mockAuction,
      status: "sold" as const,
      winnerId: "u2",
    };
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    renderComponent(
      soldAuction as unknown as Doc<"auctions"> & { categoryName?: string }
    );
    expect(screen.getByText("SOLD")).toBeDefined();
  });

  it("shows UNSOLD badge", () => {
    const unsoldAuction = { ...mockAuction, status: "unsold" as const };
    renderComponent(
      unsoldAuction as unknown as Doc<"auctions"> & { categoryName?: string }
    );
    expect(screen.getByText("UNSOLD")).toBeDefined();
  });

  it("shows item sold info for seller", () => {
    const soldAuction = {
      ...mockAuction,
      status: "sold" as const,
      sellerId: "s1",
      winnerId: "u2",
    };
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "s1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    renderComponent(
      soldAuction as unknown as Doc<"auctions"> & { categoryName?: string }
    );
    expect(screen.getByText("Item Sold")).toBeDefined();
    expect(screen.getByText(/Reserve met/i)).toBeDefined();
  });

  it("disables button when toggling", async () => {
    const toggleMock = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useMutation).mockReturnValue(
      toggleMock as unknown as ReturnType<typeof useMutation>
    );

    renderComponent();
    const watchBtn = screen.getByRole("button", { name: "Watch" });
    fireEvent.click(watchBtn);
    expect(watchBtn.getAttribute("disabled")).toBeDefined();
  });

  it("handles watchlist removal success", async () => {
    const toggleMock = vi.fn().mockResolvedValue(false); // nowWatched = false
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue(true); // isWatched = true
    vi.mocked(useMutation).mockReturnValue(
      toggleMock as unknown as ReturnType<typeof useMutation>
    );

    renderComponent();
    const watchBtn = screen.getByRole("button", { name: "Watching" });
    fireEvent.click(watchBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Removed from watchlist");
    });
  });

  it("handles watchlist toggle failure", async () => {
    const toggleMock = vi.fn().mockRejectedValue(new Error("Fail"));
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue(false);
    vi.mocked(useMutation).mockReturnValue(
      toggleMock as unknown as ReturnType<typeof useMutation>
    );

    renderComponent();
    const watchBtn = screen.getByRole("button", { name: "Watch" });
    fireEvent.click(watchBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update watchlist");
    });
  });

  it("renders UNCATEGORIZED_LABEL when categoryName is missing", () => {
    const noCatAuction = { ...mockAuction, categoryName: undefined };
    renderComponent(
      noCatAuction as unknown as Doc<"auctions"> & { categoryName?: string }
    );
    expect(screen.getByText("Uncategorized")).toBeDefined();
  });

  it("handles invalid callback URL during login redirect", () => {
    // Mock location to have invalid callback URL
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useSession>);

    mockLocation.mockReturnValue({
      pathname: "http://malicious.com",
      search: "",
      hash: "",
    });

    renderComponent();
    const watchBtn = screen.getByRole("button", { name: /watch/i });
    fireEvent.click(watchBtn);

    // It should redirect to /login?callbackUrl=/ if validation fails (unencoded)
    expect(mockNavigate).toHaveBeenCalledWith("/login?callbackUrl=/");
  });

  it("returns early if isWatched is undefined", async () => {
    const toggleMock = vi.fn();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "u1" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockReturnValue(undefined); // isWatched undefined
    vi.mocked(useMutation).mockReturnValue(
      toggleMock as unknown as ReturnType<typeof useMutation>
    );

    renderComponent();
    // Button should be disabled
    const watchBtn = screen.getByRole("button");
    expect(watchBtn).toBeDisabled();

    fireEvent.click(watchBtn);
    expect(toggleMock).not.toHaveBeenCalled();
  });
});
