import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import { FilterSidebar } from "./FilterSidebar";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock useSearchParams
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

describe("FilterSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    (useQuery as Mock).mockReturnValue(["John Deere", "Case IH"]);
  });

  const renderSidebar = (onClose?: () => void) => {
    return render(
      <BrowserRouter>
        <FilterSidebar onClose={onClose} />
      </BrowserRouter>
    );
  };

  it("renders all filter fields", () => {
    renderSidebar();
    expect(screen.getByLabelText(/Manufacturer/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/From/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/To/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Min/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Max/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Operating Hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auction Status/i)).toBeInTheDocument();
  });

  it("updates local state on input change", () => {
    renderSidebar();

    const minPriceInput = screen.getByPlaceholderText(/Min/i);
    fireEvent.change(minPriceInput, { target: { value: "5000" } });
    expect(minPriceInput).toHaveValue(5000);

    const maxPriceInput = screen.getByPlaceholderText(/Max/i);
    fireEvent.change(maxPriceInput, { target: { value: "10000" } });
    expect(maxPriceInput).toHaveValue(10000);

    const fromYearInput = screen.getByPlaceholderText(/From/i);
    fireEvent.change(fromYearInput, { target: { value: "2015" } });
    expect(fromYearInput).toHaveValue(2015);

    const toYearInput = screen.getByPlaceholderText(/To/i);
    fireEvent.change(toYearInput, { target: { value: "2023" } });
    expect(toYearInput).toHaveValue(2023);

    const maxHoursInput = screen.getByLabelText(/Max Operating Hours/i);
    fireEvent.change(maxHoursInput, { target: { value: "500" } });
    expect(maxHoursInput).toHaveValue(500);

    const statusSelect = screen.getByLabelText(/Auction Status/i);
    fireEvent.change(statusSelect, { target: { value: "closed" } });
    expect(statusSelect).toHaveValue("closed");
  });

  it("applies filters when Apply button is clicked", () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    fireEvent.change(screen.getByPlaceholderText(/Min/i), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByText(/Apply Filters/i));

    expect(mockSetSearchParams).toHaveBeenCalled();
    const calledWith = mockSetSearchParams.mock.calls[0][0];
    expect(calledWith.get("minPrice")).toBe("5000");
    expect(onClose).toHaveBeenCalled();
  });

  it("clears filters when Reset button is clicked", () => {
    mockSearchParams.set("minPrice", "5000");
    renderSidebar();

    fireEvent.click(screen.getByText(/Reset/i));

    expect(mockSetSearchParams).toHaveBeenCalled();
    const calledWith = mockSetSearchParams.mock.calls[0][0];
    expect(calledWith.get("minPrice")).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderSidebar(onClose);

    fireEvent.click(screen.getByLabelText(/Close filters/i));
    expect(onClose).toHaveBeenCalled();
  });

  it("initializes with local filters from search params", () => {
    mockSearchParams.set("status", "closed");
    mockSearchParams.set("make", "John Deere");
    mockSearchParams.set("minYear", "2010");
    mockSearchParams.set("minPrice", "1000");
    renderSidebar();

    expect(screen.getByLabelText(/Auction Status/i)).toHaveValue("closed");
    expect(screen.getByLabelText(/Manufacturer/i)).toHaveValue("John Deere");
    expect(screen.getByPlaceholderText(/From/i)).toHaveValue(2010);
    expect(screen.getByPlaceholderText(/Min/i)).toHaveValue(1000);
  });

  it("applyFilters deletes status if it is 'active'", () => {
    renderSidebar();
    // Default status is active
    fireEvent.click(screen.getByText(/Apply Filters/i));

    const calledWith = mockSetSearchParams.mock.calls[0][0];
    expect(calledWith.has("status")).toBe(false);
  });

  it("applyFilters deletes empty values", () => {
    mockSearchParams.set("make", "OldMake");
    renderSidebar();

    // Clear manufacturer
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText(/Apply Filters/i));

    const calledWith = mockSetSearchParams.mock.calls[0][0];
    expect(calledWith.has("make")).toBe(false);
  });

  it("clearFilters preserves search query 'q'", () => {
    mockSearchParams.set("q", "tractor");
    mockSearchParams.set("make", "JD");
    renderSidebar();

    fireEvent.click(screen.getByText(/Reset/i));

    const calledWith = mockSetSearchParams.mock.calls[0][0];
    expect(calledWith.get("q")).toBe("tractor");
    expect(calledWith.has("make")).toBe(false);
  });

  it("disables reset button when no filters are active", () => {
    renderSidebar();
    const resetButton = screen.getByRole("button", { name: /reset/i });
    expect(resetButton).toBeDisabled();

    // Change a filter
    fireEvent.change(screen.getByPlaceholderText(/Min/i), {
      target: { value: "5000" },
    });
    expect(resetButton).not.toBeDisabled();
  });

  it("handles applyFilters and clearFilters without onClose callback", () => {
    renderSidebar(); // No onClose passed

    // Apply
    fireEvent.click(screen.getByText(/Apply Filters/i));
    expect(mockSetSearchParams).toHaveBeenCalled();

    // Reset
    fireEvent.change(screen.getByPlaceholderText(/Min/i), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByText(/Reset/i));
    expect(mockSetSearchParams).toHaveBeenCalledTimes(2);
  });

  it("handles undefined activeMakes", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderSidebar();
    // Should not crash and should show "All Manufacturers"
    expect(screen.getByText("All Manufacturers")).toBeInTheDocument();
  });

  it("does not render close button when onClose is missing", () => {
    renderSidebar(); // No onClose
    expect(screen.queryByLabelText(/Close filters/i)).not.toBeInTheDocument();
  });
});
