import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";

import AdminUsers from "./AdminUsers";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock convex/_generated/api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      reviewKYC: "admin:reviewKYC",
    },
    users: {
      listAllProfiles: "users:listAllProfiles",
      verifyUser: "users:verifyUser",
      promoteToAdmin: "users:promoteToAdmin",
      getProfileForKYC: "users:getProfileForKYC",
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.open
const windowOpenMock = vi.fn();
vi.stubGlobal("open", windowOpenMock);

const mockAdminStats = {
  totalUsers: 100,
  verifiedSellers: 45,
};

const mockProfiles = [
  {
    _id: "id1",
    userId: "user1",
    name: "John Doe",
    email: "john@example.com",
    role: "user",
    isVerified: true,
    kycStatus: "approved",
    createdAt: Date.now(),
    isOnline: true,
  },
  {
    _id: "id2",
    userId: "user2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "user",
    isVerified: false,
    kycStatus: "pending",
    createdAt: Date.now() - 86400000,
  },
  {
    _id: "id3",
    userId: "user3",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    isVerified: true,
    kycStatus: "approved",
    createdAt: Date.now() - 172800000,
  },
  {
    _id: "id4",
    userId: "user4",
    name: "Unverified User",
    email: "unverified@example.com",
    role: "user",
    isVerified: false,
    kycStatus: "none",
    createdAt: Date.now(),
  },
];

const mockKycDetails = {
  userId: "user2",
  firstName: "Jane",
  lastName: "Smith",
  idNumber: "ID123456",
  phoneNumber: "+1234567890",
  kycEmail: "jane@example.com",
  kycDocumentIds: ["doc1"],
  kycDocumentUrls: ["https://example.com/doc1.jpg"],
};

describe("AdminUsers Page", () => {
  const mockLoadMore = vi.fn();
  const mockMutations: Record<string, ReturnType<typeof vi.fn>> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default query returns
    (useQuery as Mock).mockReturnValue(mockAdminStats);
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockProfiles,
      status: "CanLoadMore",
      loadMore: mockLoadMore,
      isLoading: false,
    });

    // Setup mutation mocks
    mockMutations[api.users.verifyUser as unknown as string] = vi
      .fn()
      .mockResolvedValue(undefined);
    mockMutations[api.users.promoteToAdmin as unknown as string] = vi
      .fn()
      .mockResolvedValue(undefined);
    mockMutations[api.admin.reviewKYC as unknown as string] = vi
      .fn()
      .mockResolvedValue(undefined);
    mockMutations[api.users.getProfileForKYC as unknown as string] = vi
      .fn()
      .mockResolvedValue(mockKycDetails);

    (useMutation as Mock).mockImplementation((apiPath) => {
      const mutation =
        mockMutations[apiPath as unknown as string] ||
        vi.fn().mockResolvedValue(undefined);
      return Object.assign(mutation, { withOptimisticUpdate: vi.fn() });
    });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminUsers />
      </BrowserRouter>
    );

  it("renders loading state", () => {
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
      isLoading: true,
    });
    renderPage();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders user list and statistics", () => {
    renderPage();

    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.getByText("Showing 4 of 100 Users")).toBeInTheDocument();
    expect(screen.getByText("45 Verified")).toBeInTheDocument();

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("Unverified User")).toBeInTheDocument();

    // Check roles
    expect(screen.getAllByText("user")).toHaveLength(3);
    expect(screen.getAllByText("admin")).toHaveLength(1);
  });

  it("filters users by search input", async () => {
    renderPage();

    const searchInput = screen.getByPlaceholderText("Search Users...");
    fireEvent.change(searchInput, { target: { value: "John" } });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 100 Users")).toBeInTheDocument();
  });

  it("handles manual user verification", async () => {
    renderPage();

    // Unverified User is unverified
    const verifyButton = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyButton);

    expect(
      mockMutations[api.users.verifyUser as unknown as string]
    ).toHaveBeenCalledWith({ userId: "user4" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("User verified");
    });
  });

  it("handles user promotion to admin", async () => {
    renderPage();

    const promoteButtons = screen.getAllByRole("button", { name: "Promote" });
    fireEvent.click(promoteButtons[0]); // Promote John Doe

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("Elevate to Admin Role?")
    ).toBeInTheDocument();
    expect(within(dialog).getByText("John Doe")).toBeInTheDocument();

    const confirmButton = within(dialog).getByRole("button", {
      name: "Promote User",
    });
    fireEvent.click(confirmButton);

    expect(
      mockMutations[api.users.promoteToAdmin as unknown as string]
    ).toHaveBeenCalledWith({ userId: "user1" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("User promoted to Admin");
    });
  });

  it("handles KYC review - Approval", async () => {
    renderPage();

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    expect(
      mockMutations[api.users.getProfileForKYC as unknown as string]
    ).toHaveBeenCalledWith({ userId: "user2" });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("KYC Verification Review")
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("Jane Smith")).toHaveLength(1);
    expect(within(dialog).getByText("****3456")).toBeInTheDocument(); // Masked ID

    // Reveal full ID
    const revealButton = within(dialog).getByRole("button", { name: "Reveal" });
    fireEvent.click(revealButton);
    expect(within(dialog).getByText("ID123456")).toBeInTheDocument();

    // Toggle back to Hide
    const hideButton = within(dialog).getByRole("button", { name: "Hide" });
    fireEvent.click(hideButton);
    expect(within(dialog).getByText("****3456")).toBeInTheDocument();

    // View document
    const viewDocButton = within(dialog).getByRole("button", {
      name: /View Document 1/i,
    });
    fireEvent.click(viewDocButton);
    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://example.com/doc1.jpg",
      "_blank",
      "noopener,noreferrer"
    );

    // Approve
    const approveButton = within(dialog).getByRole("button", {
      name: "Approve & Verify",
    });
    fireEvent.click(approveButton);

    expect(
      mockMutations[api.admin.reviewKYC as unknown as string]
    ).toHaveBeenCalledWith({
      userId: "user2",
      decision: "approve",
      reason: undefined,
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("KYC Approved");
    });
  });

  it("handles KYC review - Rejection", async () => {
    renderPage();

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const rejectButton = within(dialog).getByRole("button", {
      name: "Reject Application",
    });

    // In our component it's disabled if reason is empty
    expect(rejectButton).toBeDisabled();

    const reasonInput = within(dialog).getByPlaceholderText(
      /e.g. Documents are blurry/i
    );
    fireEvent.change(reasonInput, {
      target: { value: "Documents are blurry" },
    });

    expect(rejectButton).not.toBeDisabled();
    fireEvent.click(rejectButton);

    expect(
      mockMutations[api.admin.reviewKYC as unknown as string]
    ).toHaveBeenCalledWith({
      userId: "user2",
      decision: "reject",
      reason: "Documents are blurry",
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("KYC Rejected");
    });
  });

  it("handles load more users", async () => {
    renderPage();

    const loadMoreButton = screen.getByRole("button", {
      name: "Load More Users",
    });
    fireEvent.click(loadMoreButton);

    expect(mockLoadMore).toHaveBeenCalledWith(50);
  });

  it("shows no users found message", async () => {
    renderPage();

    const searchInput = screen.getByPlaceholderText("Search Users...");
    fireEvent.change(searchInput, { target: { value: "NonExistentUser" } });

    expect(
      screen.getByText("No users found matching your search.")
    ).toBeInTheDocument();
  });

  it("handles manual verification failure", async () => {
    mockMutations[api.users.verifyUser as unknown as string].mockRejectedValue(
      new Error("Failed")
    );
    renderPage();

    const verifyButton = screen.getByRole("button", { name: "Verify" });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Verification failed");
    });
  });

  it("handles promotion failure", async () => {
    mockMutations[
      api.users.promoteToAdmin as unknown as string
    ].mockRejectedValue(new Error("Failed"));
    renderPage();

    const promoteButtons = screen.getAllByRole("button", { name: "Promote" });
    fireEvent.click(promoteButtons[0]);

    const dialog = screen.getByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", {
      name: "Promote User",
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Promotion failed");
    });
  });

  it("handles KYC fetch failure", async () => {
    mockMutations[
      api.users.getProfileForKYC as unknown as string
    ].mockRejectedValue(new Error("Failed"));
    renderPage();

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load KYC details");
    });
  });

  it("handles KYC review submission failure", async () => {
    mockMutations[api.admin.reviewKYC as unknown as string].mockRejectedValue(
      new Error("Failed")
    );
    renderPage();

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const approveButton = within(dialog).getByRole("button", {
      name: "Approve & Verify",
    });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Review failed");
    });
  });

  it("closes KYC dialog", async () => {
    renderPage();

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders user without name as Anonymous", () => {
    const anonymousProfile = {
      _id: "id5",
      userId: "user5",
      name: undefined,
      email: "anon@example.com",
      role: "user",
      isVerified: false,
      kycStatus: "none",
      createdAt: Date.now(),
    };
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [anonymousProfile],
      status: "CanLoadMore",
      loadMore: vi.fn(),
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("handles stale response in KYC review", async () => {
    renderPage();
    const reviewButton = screen.getByRole("button", { name: "Review KYC" });

    // Mock mutation to return a different userId (stale response)
    mockMutations[
      api.users.getProfileForKYC as unknown as string
    ].mockResolvedValue({
      ...mockKycDetails,
      userId: "other-user",
    });

    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("handles invalid KYC details response", async () => {
    renderPage();
    const reviewButton = screen.getByRole("button", { name: "Review KYC" });

    // Mock mutation to return invalid data
    mockMutations[
      api.users.getProfileForKYC as unknown as string
    ].mockResolvedValue({});

    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Could not fetch profile details"
      );
    });
  });

  it("prevents double verification requests", async () => {
    renderPage();
    const verifyButtons = screen.getAllByRole("button", { name: "Verify" });

    // Click twice rapidly
    fireEvent.click(verifyButtons[0]);
    fireEvent.click(verifyButtons[0]);

    expect(
      mockMutations[api.users.verifyUser as unknown as string]
    ).toHaveBeenCalledTimes(1);
  });

  it("renders KYC review with missing details", async () => {
    renderPage();

    // Mock user with missing details
    const missingDetailsKyc = {
      userId: "user2",
      firstName: "",
      lastName: "",
      idNumber: "",
      phoneNumber: "",
      kycEmail: "",
      kycDocumentIds: [],
      kycDocumentUrls: [],
    };
    mockMutations[
      api.users.getProfileForKYC as unknown as string
    ].mockResolvedValue(missingDetailsKyc);

    const reviewButton = screen.getByRole("button", { name: "Review KYC" });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("—")).toBeInTheDocument(); // Full names fallback
    expect(within(dialog).getAllByText("Not Provided")).toHaveLength(3); // ID, Phone, Email
    expect(
      within(dialog).getByText("No documents uploaded.")
    ).toBeInTheDocument();
  });
});
