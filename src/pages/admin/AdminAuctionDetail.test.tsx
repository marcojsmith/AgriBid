import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminAuctionDetail from "./AdminAuctionDetail";

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
      getAuctionById: { name: "auctions:getAuctionById" },
      getAssignmentCandidates: { name: "auctions:getAssignmentCandidates" },
      mutations: {
        assignment: {
          assignLotToAuction: {
            name: "auctions/mutations/assignment:assignLotToAuction",
          },
          unassignLot: { name: "auctions/mutations/assignment:unassignLot" },
        },
      },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("AdminAuctionDetail Page", () => {
  const mockEvent = {
    _id: "auc1",
    title: "Spring Sale",
    startTime: Date.now(),
    endTime: Date.now() + 10000,
    status: "draft",
  };

  const mockCandidates = {
    assigned: [
      {
        _id: "l1",
        title: "Assigned Tractor",
        currentPrice: 1000,
        status: "assigned",
      },
    ],
    unassigned: [
      {
        _id: "l2",
        title: "Approved Plow",
        currentPrice: 500,
        status: "approved",
      },
    ],
  };

  const mockAssign = vi.fn();
  const mockUnassign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getAuctionById) return mockEvent;
      if (apiPath === mockApi.auctions.getAssignmentCandidates)
        return mockCandidates;
      return undefined;
    });
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.mutations.assignment.assignLotToAuction)
        return mockAssign;
      if (apiPath === mockApi.auctions.mutations.assignment.unassignLot)
        return mockUnassign;
      return vi.fn();
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/admin/auctions/auc1"]}>
        <Routes>
          <Route path="/admin/auctions/:id" element={<AdminAuctionDetail />} />
        </Routes>
      </MemoryRouter>
    );

  it("renders assigned and unassigned lots", () => {
    renderPage();
    expect(screen.getByText("Assigned Tractor")).toBeInTheDocument();
    expect(screen.getByText("Approved Plow")).toBeInTheDocument();
    expect(screen.getByText("Assigned Lots (1)")).toBeInTheDocument();
  });

  it("assigns a lot to the auction", async () => {
    mockAssign.mockResolvedValue({ success: true });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^assign$/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith({
        lotId: "l2",
        auctionId: "auc1",
      });
      expect(toast.success).toHaveBeenCalledWith("Lot assigned");
    });
  });

  it("unassigns a lot from the auction", async () => {
    mockUnassign.mockResolvedValue({ success: true });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /unassign/i }));

    await waitFor(() => {
      expect(mockUnassign).toHaveBeenCalledWith({ lotId: "l1" });
      expect(toast.success).toHaveBeenCalledWith("Lot unassigned");
    });
  });

  it("shows an error toast when assignment fails", async () => {
    mockAssign.mockRejectedValue(new Error("Already assigned"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^assign$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Already assigned");
    });
  });

  it("shows an error toast when unassignment fails", async () => {
    mockUnassign.mockRejectedValue(new Error("Unassign failed"));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /unassign/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unassign failed");
    });
  });

  it("renders a loading state while the queries resolve", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders a not-found state when the auction doesn't exist", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getAuctionById) return null;
      if (apiPath === mockApi.auctions.getAssignmentCandidates)
        return { assigned: [], unassigned: [] };
      return undefined;
    });
    renderPage();
    expect(screen.getByText("Auction Not Found")).toBeInTheDocument();
  });

  it("renders empty states when there are no lots in either list", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getAuctionById) return mockEvent;
      if (apiPath === mockApi.auctions.getAssignmentCandidates)
        return { assigned: [], unassigned: [] };
      return undefined;
    });
    renderPage();
    expect(screen.getByText("No lots assigned yet.")).toBeInTheDocument();
    expect(
      screen.getByText("No approved lots waiting for assignment.")
    ).toBeInTheDocument();
  });
});
