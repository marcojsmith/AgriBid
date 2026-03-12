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

const originalFetch = global.fetch;

describe("ListingWizard Full Coverage", () => {
  const mockCreateAuction = vi.fn();
  const mockSaveDraft = vi.fn();
  const mockSubmitForReview = vi.fn();
  const mockEnsureAuthenticated = vi.fn().mockReturnValue(true);

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "test-storage-id" }),
    });

    (useMutation as Mock).mockImplementation((apiFunc: { _path?: string }) => {
      const path = apiFunc?._path;
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

    await screen.findByText(/Step 6 of 6/i);

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
    renderWizard();
    await fillAllSteps();

    mockCreateAuction.mockRejectedValue(new Error("Submit Error"));
    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Submit Error");
    });
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
    await screen.findByText(/Step 6 of 6/i);

    fireEvent.click(screen.getByRole("button", { name: /Submit Listing/i }));
    expect(toast.info).toHaveBeenCalledWith("Checking your session...");
  });
});
