import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminSales from "./AdminSales";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      getAllAuctionEvents: { name: "auctions:getAllAuctionEvents" },
      mutations: {
        adminCrud: {
          publishAuctionContainer: {
            name: "auctions/mutations/adminCrud:publishAuctionContainer",
          },
          closeAuctionContainer: {
            name: "auctions/mutations/adminCrud:closeAuctionContainer",
          },
        },
      },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

vi.mock("./sales/AuctionEventFormDialog", () => ({
  AuctionEventFormDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="form-dialog" /> : null,
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("AdminSales Page", () => {
  const mockEvents = [
    {
      _id: "auc1",
      title: "Spring Sale",
      bannerImageUrl: "https://cdn/banner.jpg",
      startTime: Date.now() + 1000,
      endTime: Date.now() + 2000,
      status: "draft",
      lotCount: 2,
    },
    {
      _id: "auc2",
      title: "Winter Sale",
      bannerImageUrl: undefined,
      startTime: Date.now() - 5000,
      endTime: Date.now() - 1000,
      status: "published",
      lotCount: 5,
    },
  ];

  const mockPublish = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockReturnValue(mockEvents);
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.mutations.adminCrud.publishAuctionContainer)
        return mockPublish;
      if (apiPath === mockApi.auctions.mutations.adminCrud.closeAuctionContainer)
        return mockClose;
      return vi.fn();
    });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminSales />
      </BrowserRouter>
    );

  it("renders auction events with status badges and lot counts", () => {
    renderPage();
    expect(screen.getByText("Spring Sale")).toBeInTheDocument();
    expect(screen.getByText("Winter Sale")).toBeInTheDocument();
    expect(screen.getByText("2 lots")).toBeInTheDocument();
    expect(screen.getByText("5 lots")).toBeInTheDocument();
  });

  it("shows a Publish button for draft events and a Close button for published ones", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("publishes a draft auction", async () => {
    mockPublish.mockResolvedValue({ success: true });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mockPublish).toHaveBeenCalledWith({ auctionId: "auc1" });
      expect(toast.success).toHaveBeenCalledWith("Auction published");
    });
  });

  it("closes a published auction", async () => {
    mockClose.mockResolvedValue({ success: true });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(mockClose).toHaveBeenCalledWith({ auctionId: "auc2" });
      expect(toast.success).toHaveBeenCalledWith("Auction closed");
    });
  });

  it("shows an error toast when publish fails", async () => {
    mockPublish.mockRejectedValue(new Error("Nope"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  it("opens the create dialog", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("create-auction-event"));
    expect(screen.getByTestId("form-dialog")).toBeInTheDocument();
  });

  it("renders empty state when there are no events", () => {
    (useQuery as Mock).mockReturnValue([]);
    renderPage();
    expect(
      screen.getByText(/No auction events yet/i)
    ).toBeInTheDocument();
  });

  it("renders loading state while events are undefined", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
