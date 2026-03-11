import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery } from "convex/react";

import { ReviewSubmitStep } from "../listing-wizard/steps/ReviewSubmitStep";
import { useListingWizard } from "../listing-wizard/hooks/useListingWizard";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../listing-wizard/hooks/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("ReviewSubmitStep", () => {
  const mockFormData = {
    title: "Test Tractor",
    year: 2020,
    make: "John Deere",
    model: "6155R",
    location: "Cape Town",
    description: "A great machine",
    categoryId: "cat1",
    operatingHours: 500,
    startingPrice: 1000,
    reservePrice: 2000,
    durationDays: 7,
    conditionChecklist: {
      engine: true,
      hydraulics: false,
      notes: "Some notes",
    },
    images: {
      front: "img1",
      engine: "",
      cabin: "",
      rear: "",
      additional: [],
    },
  };

  const mockCategories = [{ _id: "cat1", name: "Tractors" }];

  beforeEach(() => {
    vi.clearAllMocks();
    (useListingWizard as Mock).mockReturnValue({
      formData: mockFormData,
      previews: { front: "url1" },
    });
    (useQuery as Mock).mockReturnValue(mockCategories);
  });

  it("renders all summary information", () => {
    render(<ReviewSubmitStep />);

    expect(screen.getByText("Test Tractor")).toBeInTheDocument();
    expect(screen.getByText("Tractors")).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("John Deere 6155R")).toBeInTheDocument();
    expect(screen.getByText("Cape Town")).toBeInTheDocument();
    expect(screen.getByText("500 hrs")).toBeInTheDocument();
    expect(screen.getByText(/7 Days/i)).toBeInTheDocument();
  });

  it("renders prices with correct formatting", () => {
    render(<ReviewSubmitStep />);

    const startingPriceEl = screen.getByText(/Starting Price/i);
    expect(startingPriceEl).toBeInTheDocument();
    const startingPriceContainer = startingPriceEl.parentElement;
    expect(startingPriceContainer).not.toBeNull();
    expect(startingPriceContainer!.textContent).toMatch(/1\s*000/);

    const reservePriceEl = screen.getByText(/Reserve Price/i);
    expect(reservePriceEl).toBeInTheDocument();
    const reservePriceContainer = reservePriceEl.parentElement;
    expect(reservePriceContainer).not.toBeNull();
    expect(reservePriceContainer!.textContent).toMatch(/2\s*000/);
  });

  it("renders condition checklist badges", () => {
    render(<ReviewSubmitStep />);

    expect(screen.getByText(/engine: YES/i)).toBeInTheDocument();
    expect(screen.getByText(/hydraulics: NO/i)).toBeInTheDocument();
  });

  it("renders media gallery previews", () => {
    render(<ReviewSubmitStep />);

    // Check for the image with correct alt text
    const img = screen.getByAltText(/Front 45° View/i);
    expect(img).toHaveAttribute("src", "url1");
  });
});
