import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";

import AdminEquipmentCatalog from "./AdminEquipmentCatalog";

// Mocking Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
      categories: {
        getCategories: "admin:categories:getCategories",
      },
      equipmentMetadata: {
        getAllEquipmentMetadata:
          "admin:equipmentMetadata:getAllEquipmentMetadata",
      },
    },
  },
}));

describe("AdminEquipmentCatalog Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as Mock).mockReturnValue(vi.fn());
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminEquipmentCatalog />
      </BrowserRouter>
    );

  it("renders loading state initially", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderPage();
    // From AdminLayout header
    expect(screen.getByText("Equipment Catalog")).toBeInTheDocument();
    // From EquipmentMetadataEditor
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders real layout and editor when loaded", async () => {
    (useQuery as Mock).mockImplementation((query: string) => {
      if (query === "admin:getAdminStats") return { totalUsers: 100 };
      if (query === "admin:categories:getCategories") return [];
      if (query === "admin:equipmentMetadata:getAllEquipmentMetadata")
        return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      // Use getAllByText and check that at least one is visible/present
      expect(screen.getAllByText("Equipment Catalog").length).toBeGreaterThan(
        0
      );
    });

    // Check if real EquipmentMetadataEditor content is present
    expect(screen.getByText(/Manage manufacturer makes/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });
});
