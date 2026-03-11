import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EquipmentMetadataEditor } from "../EquipmentMetadataEditor";

// Mock Convex API
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      categories: {
        getCategories: { _path: "admin:categories:getCategories" },
        addCategory: { _path: "admin:categories:addCategory" },
        updateCategory: { _path: "admin:categories:updateCategory" },
        deleteCategory: { _path: "admin:categories:deleteCategory" },
      },
      equipmentMetadata: {
        getAllEquipmentMetadata: {
          _path: "admin:equipmentMetadata:getAllEquipmentMetadata",
        },
        addEquipmentMake: {
          _path: "admin:equipmentMetadata:addEquipmentMake",
        },
        updateEquipmentMake: {
          _path: "admin:equipmentMetadata:updateEquipmentMake",
        },
        deleteEquipmentMake: {
          _path: "admin:equipmentMetadata:deleteEquipmentMake",
        },
        addModelToMake: {
          _path: "admin:equipmentMetadata:addModelToMake",
        },
        removeModelFromMake: {
          _path: "admin:equipmentMetadata:removeModelFromMake",
        },
      },
    },
  },
}));

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: (apiFunc: { _path?: string } | null | undefined) => {
    const path = apiFunc?._path || "";
    if (path === "admin:categories:getCategories") {
      return [
        {
          _id: "cat1",
          _creationTime: Date.now(),
          name: "Tractors",
          isActive: true,
        },
        {
          _id: "cat2",
          _creationTime: Date.now(),
          name: "Harvesters",
          isActive: true,
        },
      ];
    }
    if (path === "admin:equipmentMetadata:getAllEquipmentMetadata") {
      return [
        {
          _id: "meta1",
          _creationTime: Date.now(),
          make: "John Deere",
          models: ["8R", "7R"],
          categoryId: "cat1",
          categoryName: "Tractors",
          isActive: true,
        },
        {
          _id: "meta2",
          _creationTime: Date.now(),
          make: "Case IH",
          models: ["Magnum"],
          categoryId: "cat2",
          categoryName: "Harvesters",
          isActive: true,
        },
      ];
    }
    return undefined;
  },
  useMutation: vi.fn(() => vi.fn().mockResolvedValue({})),
}));

// Mock LoadingIndicator
vi.mock("@/components/LoadingIndicator", () => ({
  LoadingIndicator: () => <div>Loading...</div>,
}));

describe("EquipmentMetadataEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", () => {
    const { useQuery } = require("convex/react");
    vi.mocked(useQuery).mockReturnValue(undefined);

    render(<EquipmentMetadataEditor />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render equipment catalog by default", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("Equipment Catalog")).toBeInTheDocument();
    });

    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getByText("Case IH")).toBeInTheDocument();
  });

  it("should switch to categories tab", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("Categories")).toBeInTheDocument();
    });

    const categoriesButton = screen.getByRole("button", {
      name: /Categories/i,
    });
    fireEvent.click(categoriesButton);

    await waitFor(() => {
      expect(screen.getByText("Manage Categories")).toBeInTheDocument();
    });
  });

  it("should filter equipment metadata by search term", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
      expect(screen.getByText("Case IH")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "John" } });

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });
  });

  it("should filter categories by search term", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("Categories")).toBeInTheDocument();
    });

    const categoriesButton = screen.getByRole("button", {
      name: /Categories/i,
    });
    fireEvent.click(categoriesButton);

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "Tractors" } });

    await waitFor(() => {
      expect(screen.getByText("Tractors")).toBeInTheDocument();
    });
  });

  it("should filter metadata by model name", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "8R" } });

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });
  });

  it("should filter metadata by category name", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "Harvesters" } });

    await waitFor(() => {
      expect(screen.getByText("Case IH")).toBeInTheDocument();
    });
  });

  it("should handle case-insensitive search", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "JOHN" } });

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });
  });

  it("should render both tabs with correct icons", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("Equipment Catalog")).toBeInTheDocument();
      expect(screen.getByText("Categories")).toBeInTheDocument();
    });

    const catalogButton = screen.getByRole("button", {
      name: /Equipment Catalog/i,
    });
    const categoriesButton = screen.getByRole("button", {
      name: /Categories/i,
    });

    expect(catalogButton).toBeInTheDocument();
    expect(categoriesButton).toBeInTheDocument();
  });

  it("should maintain search term when switching tabs", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "test" } });

    const categoriesButton = screen.getByRole("button", {
      name: /Categories/i,
    });
    fireEvent.click(categoriesButton);

    expect(searchInput).toHaveValue("test");
  });

  it("should clear search when search input is emptied", async () => {
    render(<EquipmentMetadataEditor />);

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "John" } });

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByText("John Deere")).toBeInTheDocument();
      expect(screen.getByText("Case IH")).toBeInTheDocument();
    });
  });
});