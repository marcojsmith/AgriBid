// app/src/components/__tests__/ListingWizard.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ListingWizard } from "@/components/listing-wizard/ListingWizard";

// Mock Convex API
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getCategories: { _path: "auctions:getCategories" },
      getEquipmentMetadata: { _path: "auctions:getEquipmentMetadata" },
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
      return [
        { _id: "cat1", name: "Tractor", isActive: true },
        { _id: "cat2", name: "Harvester", isActive: true },
      ];
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
            models: ["6155R", "8R 410"],
            categoryId: "cat1",
          },
          {
            _id: "m2",
            make: "Case IH",
            models: ["Magnum 340"],
            categoryId: "cat1",
          },
        ],
        status: "Exhausted",
        loadMore: vi.fn(),
      };
    }
    return { results: [], status: "Exhausted", loadMore: vi.fn() };
  },
  useMutation: (apiFunc: { _path?: string } | string | null | undefined) => {
    const path =
      typeof apiFunc === "object" && apiFunc !== null ? apiFunc._path : apiFunc;
    const isUpload =
      typeof path === "string" && path.includes("generateUploadUrl");

    if (isUpload) {
      return vi.fn().mockResolvedValue("http://upload.url");
    }
    return vi.fn().mockResolvedValue({});
  },
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(() => ({
    data: { user: { name: "Test Seller" } },
    isPending: false,
  })),
}));

// Mock browser APIs
const originalFetch = global.fetch;

describe("ListingWizard", () => {
  beforeEach(() => {
    localStorage.removeItem("agribid_listing_step");
    localStorage.removeItem("agribid_listing_draft");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId: "test-storage-id" }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
    localStorage.removeItem("agribid_listing_step");
    localStorage.removeItem("agribid_listing_draft");
  });

  const renderWizard = () =>
    render(
      <MemoryRouter>
        <ListingWizard />
      </MemoryRouter>
    );

  const fillStep1 = () => {
    fireEvent.change(screen.getByLabelText(/Manufacturing Year/i), {
      target: { value: "2024" },
    });
    fireEvent.change(screen.getByLabelText(/Location/i), {
      target: { value: "Pretoria, ZA" },
    });
    fireEvent.change(screen.getByLabelText(/Listing Title/i), {
      target: { value: "Test Auction Title" },
    });
    fireEvent.change(screen.getByLabelText(/Operating Hours/i), {
      target: { value: "1200" },
    });
  };

  const navigateToStep4 = () => {
    fillStep1();
    fireEvent.click(screen.getByText(/Next Step/i));

    // Select category first
    fireEvent.click(screen.getByText("Tractor"));

    fireEvent.click(screen.getByText("John Deere"));
    fireEvent.click(screen.getByText("6155R"));
    fireEvent.click(screen.getByText(/Next Step/i));

    const yesButtons = screen.getAllByText("Yes");
    yesButtons.forEach((btn) => {
      fireEvent.click(btn);
    });
    fireEvent.click(screen.getByText(/Next Step/i));
  };

  it("renders the first step by default", () => {
    renderWizard();

    expect(
      screen.getAllByText(/General Information/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
  });

  it("navigates to step 2 when fields are filled", () => {
    renderWizard();

    fillStep1();

    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Step 2 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Specifications/i)).toBeInTheDocument();
  });

  it("requires all condition checklist items to be filled", () => {
    renderWizard();

    // Fill Step 1
    fillStep1();
    fireEvent.click(screen.getByText(/Next Step/i));

    // Select category
    fireEvent.click(screen.getByText("Tractor"));

    // Fill Step 2 (Manufacturer/Model)
    fireEvent.click(screen.getByText("John Deere"));
    fireEvent.click(screen.getByText("6155R"));
    fireEvent.click(screen.getByText(/Next Step/i));

    expect(screen.getByText(/Condition Checklist/i)).toBeInTheDocument();

    // Fill all Yes buttons
    const yesButtons = screen.getAllByText("Yes");
    yesButtons.forEach((btn) => {
      fireEvent.click(btn);
    });

    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 4 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Media Gallery/i)).toBeInTheDocument();
  });

  it("validates required image slots", async () => {
    renderWizard();

    navigateToStep4();

    expect(screen.getByText(/Media Gallery/i)).toBeInTheDocument();

    // Try to proceed without images
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 4 of 6/i)).toBeInTheDocument();

    // Mock file upload for a non-front slot (e.g., Engine Bay)
    const file = new File(["(⌐□_□)"], "engine.png", { type: "image/png" });
    const input = screen.getByLabelText(/Engine Bay/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/ENGINE BAY \(UPLOADED\)/i)).toBeInTheDocument();
    });

    // Should now proceed as at least one image is uploaded
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(screen.getByText(/Step 5 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing & Duration/i)).toBeInTheDocument();
  });
});
