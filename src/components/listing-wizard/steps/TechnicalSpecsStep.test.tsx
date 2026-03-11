import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery, usePaginatedQuery } from "convex/react";

import { TechnicalSpecsStep } from "./TechnicalSpecsStep";
import { useListingWizard } from "../hooks/useListingWizard";
import { type ListingWizardContextType } from "../context/ListingWizardContextDef";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));

vi.mock("../hooks/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("TechnicalSpecsStep", () => {
  const mockUpdateField = vi.fn();
  const mockCategories = [
    { _id: "cat1", name: "Tractors" },
    { _id: "cat2", name: "Harvesters" },
  ];
  const mockMetadata = [
    { categoryId: "cat1", make: "John Deere", models: ["6155R", "8R 410"] },
    { categoryId: "cat1", make: "Case IH", models: ["Magnum 340"] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue(mockCategories);
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: mockMetadata,
      status: "Exhausted",
      isLoading: false,
      loadMore: vi.fn(),
    } as unknown as ReturnType<typeof usePaginatedQuery>);
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        categoryId: "",
        make: "",
        model: "",
      } as unknown as Record<string, unknown>,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);
  });

  it("renders loading state", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<TechnicalSpecsStep />);
    expect(screen.getByText(/Fetching Specifications/i)).toBeInTheDocument();
  });

  it("renders categories", () => {
    render(<TechnicalSpecsStep />);
    expect(screen.getByText("Tractors")).toBeInTheDocument();
    expect(screen.getByText("Harvesters")).toBeInTheDocument();
  });

  it("calls updateField when category is selected", () => {
    render(<TechnicalSpecsStep />);
    fireEvent.click(screen.getByText("Tractors"));
    expect(mockUpdateField).toHaveBeenCalledWith("categoryId", "cat1");
  });

  it("renders makes when category is selected", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        categoryId: "cat1",
        make: "",
        model: "",
      } as unknown as Record<string, unknown>,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    render(<TechnicalSpecsStep />);
    expect(screen.getByText("Select Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("John Deere")).toBeInTheDocument();
    expect(screen.getByText("Case IH")).toBeInTheDocument();
  });

  it("renders models when make is selected", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        categoryId: "cat1",
        make: "John Deere",
        model: "",
      } as unknown as Record<string, unknown>,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    render(<TechnicalSpecsStep />);
    expect(screen.getByText("Select Model")).toBeInTheDocument();
    expect(screen.getByText("6155R")).toBeInTheDocument();
    expect(screen.getByText("8R 410")).toBeInTheDocument();
  });

  it("calls updateField when model is selected", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        categoryId: "cat1",
        make: "John Deere",
        model: "",
      } as unknown as Record<string, unknown>,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    render(<TechnicalSpecsStep />);
    fireEvent.click(screen.getByText("6155R"));
    expect(mockUpdateField).toHaveBeenCalledWith("model", "6155R");
  });
});
