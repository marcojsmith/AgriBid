import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { useAuthRedirect } from "@/hooks/useAuthRedirect";

import { ListingWizard } from "./ListingWizard";

// Mock Convex API
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getCategories: { _path: "auctions:getCategories" },
      getEquipmentMetadata: { _path: "auctions:getEquipmentMetadata" },
      createAuction: { _path: "auctions:createAuction" },
      saveDraft: { _path: "auctions:saveDraft" },
      submitForReview: { _path: "auctions:submitForReview" },
      generateUploadUrl: { _path: "auctions:generateUploadUrl" },
      deleteUpload: { _path: "auctions:deleteUpload" },
    },
    admin: {
      categories: {
        addCategory: { _path: "admin:categories:addCategory" },
        updateCategory: { _path: "admin:categories:updateCategory" },
        deleteCategory: { _path: "admin:categories:deleteCategory" },
      },
      equipmentMetadata: {
        addEquipmentMake: { _path: "admin:equipmentMetadata:addEquipmentMake" },
        updateEquipmentMake: {
          _path: "admin:equipmentMetadata:updateEquipmentMake",
        },
      },
    },
  },
}));

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: (apiFunc: { _path?: string } | null | undefined) => {
    const path = apiFunc?._path || "";
    if (path === "auctions:getCategories") {
      return [{ _id: "cat1", name: "Tractor", isActive: true }];
    }
    return [];
  },
  usePaginatedQuery: (apiFunc: { _path?: string } | null | undefined) => {
    const path = apiFunc?._path || "";
    if (path === "auctions:getEquipmentMetadata") {
      return {
        results: [
          {
            _id: "m1",
            make: "John Deere",
            models: ["6155R"],
            categoryId: "cat1",
          },
        ],
        status: "Exhausted",
        loadMore: vi.fn(),
      };
    }
    return { results: [], status: "Exhausted", loadMore: vi.fn() };
  },
  useMutation: vi.fn(),
}));

// Mock auth client and redirect
vi.mock("@/hooks/useAuthRedirect", () => ({
  useAuthRedirect: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock useSearchParams
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    MemoryRouter: actual.MemoryRouter,
    Link: actual.Link,
  };
});

const originalFetch = global.fetch;

describe("ListingWizard Full Coverage", () => {
  const mockCreateAuction = vi.fn();
  const mockSaveDraft = vi.fn();
  const mockSubmitForReview = vi.fn();
  const mockEnsureAuthenticated = vi.fn().mockReturnValue(true);

  beforeEach(() => {
    mockSearchParams.delete("edit");
    localStorage.clear();
    mockEnsureAuthenticated.mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "test-storage-id" }),
    });

    (useMutation as Mock).mockImplementation((apiFunc: { _path: string }) => {
      const path = apiFunc._path;
      if (path === "auctions:createAuction") return mockCreateAuction;
      if (path === "auctions:saveDraft") return mockSaveDraft;
      if (path === "auctions:submitForReview") return mockSubmitForReview;
      if (path === "auctions:generateUploadUrl")
        return vi.fn().mockResolvedValue("http://upload.url");
      return vi.fn();
    });

    (useAuthRedirect as Mock).mockReturnValue({
      ensureAuthenticated: mockEnsureAuthenticated,
      isPending: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const renderWizard = () =>
    render(
      <MemoryRouter>
        <ListingWizard />
      </MemoryRouter>
    );

  const fillStep1 = () => {
    fireEvent.change(screen.getByLabelText(/Listing Title/i), {
      target: { value: "Test Title" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2026/i), {
      target: { value: "2024" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Johannesburg/i), {
      target: { value: "Pretoria" },
    });
    fireEvent.change(screen.getByLabelText(/Operating Hours/i), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText(/Equipment Description/i), {
      target: { value: "Desc" },
    });
  };

  const fillAllSteps = async () => {
    // Step 1: General Info
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 2: Tech Specs
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i));
    fireEvent.click(screen.getByText(/John Deere/i));
    fireEvent.click(screen.getByText(/6155R/i));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 3: Condition
    const yesButtons = await screen.findAllByRole("button", { name: /yes/i });
    yesButtons.forEach((btn) => fireEvent.click(btn));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 4: Media
    const file = new File(["(⌐□_□)"], "front.png", { type: "image/png" });
    const frontInput = screen.getByLabelText(
      /Upload image for slot Front 45° View/i
    );
    fireEvent.change(frontInput, { target: { files: [file] } });
    await screen.findByText(/FRONT 45° VIEW \(UPLOADED\)/i);
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    // Step 5: Pricing
    fireEvent.change(screen.getByLabelText(/Starting Price \(R\)/i), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText(/Reserve Price \(R\)/i), {
      target: { value: "2000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
  };

  it("handles localStorage corruption", () => {
    localStorage.setItem("agribid_listing_draft", "invalid-json");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWizard();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse saved draft"),
      expect.any(Error)
    );
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("handles save draft without categoryId (local only)", async () => {
    renderWizard();
    fillStep1(); // Fill to ensure valid data for auto-save if needed

    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Draft saved locally")
      );
      expect(toast.success).toHaveBeenCalledWith("Draft saved successfully!");
    });
    spy.mockRestore();
  });

  it("handles save draft with categoryId (server sync)", async () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i)); // sets categoryId

    mockSaveDraft.mockResolvedValue("new-auction-id");
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Draft saved successfully!");
    });
  });

  it("handles save draft error", async () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i));

    mockSaveDraft.mockRejectedValue(new Error("Save Failed"));
    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Save Failed");
    });
  });

  it("submits a new auction successfully", async () => {
    renderWizard();
    await fillAllSteps();

    await screen.findByText(/Review & Submit/i);

    mockCreateAuction.mockResolvedValue({ success: true });
    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(mockCreateAuction).toHaveBeenCalled();
      expect(screen.getByText(/Submission Received/i)).toBeInTheDocument();
    });
  });

  it("submits an existing draft (edit mode) successfully", async () => {
    // Manually set draft with auctionId in localStorage
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({ auctionId: "a1", title: "Existing" })
    );

    renderWizard();
    await fillAllSteps();

    mockSaveDraft.mockResolvedValue("a1");
    mockSubmitForReview.mockResolvedValue({ success: true });

    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled();
      expect(mockSubmitForReview).toHaveBeenCalledWith({ auctionId: "a1" });
      expect(screen.getByText(/Submission Received/i)).toBeInTheDocument();
    });
  });

  it("handles submission failure", async () => {
    const { unmount } = renderWizard();
    await fillAllSteps();

    mockCreateAuction.mockRejectedValueOnce(new Error("Submit Error"));
    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Submit Error");
    });

    unmount();
  });

  it("shows info toast if session is pending during submit", async () => {
    (useAuthRedirect as Mock).mockReturnValue({
      ensureAuthenticated: mockEnsureAuthenticated,
      isPending: true,
    });

    // Set step 6 in localStorage
    localStorage.setItem("agribid_listing_step", "5");
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({
        title: "Tractor",
        categoryId: "cat1",
        make: "John Deere",
        model: "6155R",
        year: 2024,
        operatingHours: 100,
        location: "Pretoria",
        description: "Desc",
        conditionChecklist: {
          engine: true,
          hydraulics: true,
          tires: true,
          serviceHistory: true,
        },
        images: { front: "img.jpg" },
        startingPrice: 1000,
        reservePrice: 2000,
        durationDays: 7,
      })
    );

    renderWizard();

    // We are on step 6
    await screen.findByRole("heading", { name: /Review & Submit/i });

    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));
    expect(toast.info).toHaveBeenCalledWith("Checking your session...");
  });

  it("stops submission if authentication check fails", async () => {
    mockEnsureAuthenticated.mockReturnValue(false);

    // Set step 6 in localStorage
    localStorage.setItem("agribid_listing_step", "5");
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({ title: "T" })
    );

    renderWizard();
    await screen.findByRole("heading", { name: /Review & Submit/i });

    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));
    expect(mockCreateAuction).not.toHaveBeenCalled();
  });

  it("initializes with saved step from localStorage", async () => {
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({ title: "Saved" })
    );
    localStorage.setItem("agribid_listing_step", "2");

    renderWizard();

    expect(screen.getByText(/Condition Checklist/i)).toBeInTheDocument();
  });

  it("prevents double submission while submitting", async () => {
    // Manually set a valid full draft in localStorage and start at last step
    const fullDraft = {
      title: "Tractor",
      categoryId: "cat1",
      make: "John Deere",
      model: "6155R",
      year: 2024,
      operatingHours: 100,
      location: "Pretoria",
      description: "Desc",
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
      images: { front: "img.jpg" },
      startingPrice: 1000,
      reservePrice: 2000,
      durationDays: 7,
    };
    localStorage.setItem("agribid_listing_draft", JSON.stringify(fullDraft));
    localStorage.setItem("agribid_listing_step", "5");

    renderWizard();
    await screen.findByRole("heading", { name: /Review & Submit/i });

    mockCreateAuction.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 100);
        })
    );

    const submitBtn = screen.getByRole("button", { name: /Submit Listing/i });

    // First click
    fireEvent.click(submitBtn);
    // Second click immediately after
    fireEvent.click(submitBtn);

    // Verify it was called exactly once despite two clicks
    expect(mockCreateAuction).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Submission Received/i)).toBeInTheDocument();
    });
  });

  it("handles validation error during submit and jumps to that step", async () => {
    // Set step 6 but with empty title (invalid step 1)
    localStorage.setItem("agribid_listing_step", "5");
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({
        categoryId: "cat1",
        title: "", // Missing!
        location: "Loc",
        year: 2024,
        operatingHours: 10,
        make: "JD",
        model: "M",
        conditionChecklist: {
          engine: true,
          hydraulics: true,
          tires: true,
          serviceHistory: true,
        },
        images: { front: "i.jpg" },
        startingPrice: 100,
        reservePrice: 200,
        durationDays: 7,
      })
    );

    renderWizard();
    await screen.findByRole("heading", { name: /Review & Submit/i });

    const submitBtn = screen.getByRole("button", { name: /Submit Listing/i });
    fireEvent.click(submitBtn);

    // Should jump to General Information step (Step 1)
    await waitFor(() => {
      // Step indicator should show Step 1
      expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Listing Title/i)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith("Title is required");
    });
  });

  it("saves auctionId to form data after first server-side draft save", async () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Technical Specifications/i);

    // Select category, manufacturer, and model to ensure valid step 2
    fireEvent.click(screen.getByText(/Tractor/i));
    fireEvent.click(screen.getByText(/John Deere/i));
    fireEvent.click(screen.getByText(/6155R/i));

    // Fill pricing to ensure overall form progress if needed,
    // though Save Draft should work now.
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({
        ...JSON.parse(localStorage.getItem("agribid_listing_draft") || "{}"),
        startingPrice: 1000,
        reservePrice: 2000,
      })
    );

    mockSaveDraft.mockResolvedValue("new-id-123");

    // Click Save Draft button
    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });

    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled();
      const saved = JSON.parse(
        localStorage.getItem("agribid_listing_draft") || "{}"
      ) as { auctionId?: string };
      expect(saved.auctionId).toBe("new-id-123");
    });
  });

  it("prevents double save draft while saving", async () => {
    renderWizard();
    fillStep1();

    // Move to step 2 and select category to set categoryId
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i));

    mockSaveDraft.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("id1"), 100))
    );

    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    expect(mockSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("shows technical specs empty state when no category selected", async () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

    await screen.findByText(/Technical Specifications/i);
    expect(
      screen.getByText(/Select a category to view available equipment catalog/i)
    ).toBeInTheDocument();
  });

  it("prevents handleSaveDraft when isSubmitting is true", async () => {
    // We can simulate isSubmitting by making createAuction a long-running promise
    renderWizard();
    await fillAllSteps();

    mockCreateAuction.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 500)
        )
    );

    const submitBtn = screen.getByRole("button", { name: /Submit Listing/i });
    fireEvent.click(submitBtn);

    // Now isSubmitting should be true. Try to click Save Draft.
    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
    fireEvent.click(saveBtn);

    // SaveDraft should NOT have been called
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("handles handleSaveDraft when authentication check fails", async () => {
    mockEnsureAuthenticated.mockReturnValue(false);
    renderWizard();
    fillStep1();

    // Move to step 2 and select category to enable server-side save
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i));

    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
    fireEvent.click(saveBtn);

    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  it("normalizes draft with missing conditionChecklist", () => {
    // This tests the branch in validateAndNormalizeDraft: ...(data.conditionChecklist || {})
    localStorage.setItem(
      "agribid_listing_draft",
      JSON.stringify({
        title: "Test",
        conditionChecklist: undefined,
      })
    );

    renderWizard();
    // If it didn't crash, the branch was hit and fallback used
    expect(screen.getByLabelText(/Listing Title/i)).toHaveValue("Test");
  });

  it("handles invalid step in localStorage", () => {
    localStorage.setItem("agribid_listing_step", "invalid");
    renderWizard();
    // Should fallback to step 0
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
  });

  it("handles non-Error objects in localStorage parsing catch", () => {
    localStorage.setItem("agribid_listing_draft", "invalid-json");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock JSON.parse to throw a non-Error string
    const originalParse = JSON.parse;
    JSON.parse = vi.fn().mockImplementation(() => {
      throw "Not an error object";
    });

    try {
      renderWizard();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse saved draft"),
        expect.any(Error)
      );
    } finally {
      JSON.parse = originalParse;
      spy.mockRestore();
    }
  });

  it("handles save draft when localStorage is empty during id update", async () => {
    renderWizard();
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
    await screen.findByText(/Tractor/i);
    fireEvent.click(screen.getByText(/Tractor/i));

    mockSaveDraft.mockResolvedValue("new-id-999");

    // Clear localStorage JUST before the update happens in handleSaveDraft
    // This is a bit tricky to time, but we can mock localStorage.getItem
    const originalGetItem = localStorage.getItem;
    let cleared = false;
    localStorage.getItem = vi.fn().mockImplementation((key) => {
      if (key === "agribid_listing_draft" && cleared) return null;
      return originalGetItem.call(localStorage, key);
    });

    const saveBtn = screen.getByRole("button", { name: /Save Draft/i });
    fireEvent.click(saveBtn);
    cleared = true;

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled();
      const saved = JSON.parse(
        originalGetItem.call(localStorage, "agribid_listing_draft") || "{}"
      ) as { auctionId?: string };
      expect(saved.auctionId).toBe("new-id-999");
    });
    localStorage.getItem = originalGetItem;
  });

  it("uses editingAuctionId from search params for submission", async () => {
    // Mock search params with 'edit'
    mockSearchParams.set("edit", "a-edit-123");

    renderWizard();
    await fillAllSteps();

    mockSaveDraft.mockResolvedValue("a-edit-123");
    mockSubmitForReview.mockResolvedValue({ success: true });

    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          auctionId: "a-edit-123",
        })
      );
      expect(mockSubmitForReview).toHaveBeenCalledWith({
        auctionId: "a-edit-123",
      });
    });
  });

  it("handles submission failure with non-Error object", async () => {
    renderWizard();
    await fillAllSteps();

    mockCreateAuction.mockRejectedValueOnce("String error");
    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Submission failed");
    });
  });
});
