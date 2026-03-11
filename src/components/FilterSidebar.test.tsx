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
});
