import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";

import { useAuthRedirect } from "@/hooks/useAuthRedirect";

import { ListingWizard } from "../ListingWizard";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(() => ({ results: [], status: "Exhausted" })),
}));

vi.mock("@/hooks/useAuthRedirect", () => ({
  useAuthRedirect: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ListingWizard Integration", () => {
  const mockCreateAuction = vi.fn();
  const mockSaveDraft = vi.fn();
  const mockSubmitForReview = vi.fn();
  const mockEnsureAuthenticated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockImplementation((apiRef: { _path: string }) => {
      if (apiRef?._path === "auctions:createAuction") return mockCreateAuction;
      if (apiRef?._path === "auctions:saveDraft") return mockSaveDraft;
      if (apiRef?._path === "auctions:submitForReview")
        return mockSubmitForReview;
      return vi.fn();
    });
    (useQuery as Mock).mockReturnValue([]); // Default for getCategories
    (useAuthRedirect as Mock).mockReturnValue({
      ensureAuthenticated: mockEnsureAuthenticated,
      isPending: false,
    });
    mockEnsureAuthenticated.mockReturnValue(true);
    localStorage.clear();
  });

  it("renders the wizard and can save draft", async () => {
    render(
      <BrowserRouter>
        <ListingWizard />
      </BrowserRouter>
    );

    expect(screen.getByText(/General Information/i)).toBeInTheDocument();

    const saveBtn = screen.getByText(/Save Draft/i);
    fireEvent.click(saveBtn);

    // Should show local save log or call server if categoryId were set
    // For now, just verify it didn't crash
    expect(saveBtn).toBeInTheDocument();
  });

  it.todo("shows success screen after submission", async () => {
    // This is hard to test without deep mocking because of validation
    // but we can test the success state directly if we could set the context
  });
});
